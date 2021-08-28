const express = require('express')
const mongoose = require('mongoose')
const { body, validationResult } = require('express-validator')
const exphbs = require('express-handlebars')
const sendgrid = require('@sendgrid/mail')
const cookieParser = require('cookie-parser')
require('dotenv').config()

const User = require('./models/user')

const app = express()
app.engine('handlebars', exphbs())
app.set('view engine', 'handlebars')
app.use(express.urlencoded({ extended: true }))
sendgrid.setApiKey(process.env.SENDGRID_KEY)

app.use(cookieParser(process.env.SIGNING_SECRET || 'secret'));

mongoose.connect(`mongodb+srv://sit313:${process.env.MONGODB_PASSWORD}@cluster0.3j7yw.mongodb.net/iService?retryWrites=true&w=majority`, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
})

app.get('/signup', guest, (req, res) => {
    res.render('signup', { layout: false })
})

app.post(
    '/signup',
    guest,
    body(['first_name', 'last_name', 'street_line_1', 'state', 'city', 'email', 'password', 'country_of_residence'], 'This field is required').not().isEmpty(),
    body('email', 'This field must be a valid email').isEmail(),
    body('password', 'Password must be at least 8 characters long').isLength({ min: 8 }),
    body('password').custom((value, { req }) => {
        if (value !== req.body.password_confirm) {
            throw new Error('Password confirmation does not match password')
        }

        return true
    }),
    body('email').custom(async (value) => {
        if (await User.exists({email: value})) {
            throw new Error('Email is already in use')
        }

        return true;
    }),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            console.log(errors);
            return res.status(422).render('signup', {
                layout: false,
                errors: errors.mapped(),
                old_data: req.body
            })
        }
        try {
            const { first_name, last_name, email, password, country_of_residence, street_line_1, street_line_2, state, postcode, city, phone_number } = req.body

            const user = new User({
                first_name,
                last_name,
                email,
                password,
                country_of_residence,
                phone_number,
                address: {
                    street_line_1,
                    street_line_2,
                    state,
                    postcode,
                    city
                }
            })

            await user.save()

            const message = {
                to: user.email,
                from: 'a.afifi5299@gmail.com',
                subject: 'Welcome Email',
                text: `Hi ${user.first_name}, welcome to iService`,
                html: `Hi <strong>${user.first_name}</strong>,<br><br> welcome to iService`,
            }

            await sendgrid.send(message)

            res.redirect('/login')
        } catch (e) {
            res.status(500).send(e)
        }
    }
)

app.get('/login', guest, (req, res) => {
    res.render('login', { layout: false })
})

app.post(
    '/login',
    guest,
    body(['email', 'password'], 'This field is required').not().isEmpty(),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(422).render('login', {
                layout: false,
                errors: errors.mapped(),
                old_data: req.body
            })
        }

        const { email, password } = req.body

        try {
            const user = await User.findOne({ email});
            await user.verifyPassword(password);

            res.cookie("iservice_auth", user._id, {
                signed: true,
                maxAge: 30 * 24 * 60 * 60,
            });

            res.redirect('/authed')
        } catch {
            res.status(422).render('login', {
                layout: false,
                errors: {
                    email: {
                        msg: 'Incorrect credentials'
                    }
                },
                old_data: req.body
            })
        }
    }
)

app.get('/authed', auth, (req, res) => {
    res.send('you are authenticated')
})

function auth(req, res, next) {
    if (req.signedCookies.iservice_auth) return next()
    res.status(401).redirect('/login')
}

function guest(req, res, next) {
    if (!req.signedCookies.iservice_auth) return next()
    res.status(401).redirect('/authed')
}

const port = process.env.PORT || 3025;
app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})