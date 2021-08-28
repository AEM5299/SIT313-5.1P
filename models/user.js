const mongoose = require('mongoose');
const argon2 = require('argon2');

const UserSchema = new mongoose.Schema(
    {
        first_name: {
            type: String,
            required: true
        },
        last_name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
            minLength: 8,
        },
        country_of_residence: {
            type: String,
            required: true,
            enum: ['australia', 'usa']
        },
        address: {
            street_line_1: {
                type: String,
                required: true
            },
            street_line_2: {
                type: String,
                required: false
            },
            city: {
                type: String,
                required: true
            },
            state: {
                type: String,
                required: true
            },
            postcode: {
                type: String,
                required: false
            }
        },
        phone_number: {
            type: String,
            required: false
        },
    });

UserSchema.pre('save', async function save(next) {
    if (!this.isModified('password')) return next();
    try {
        this.password = await argon2.hash(this.password);
        return next();
    } catch (err) {
        console.log(err)
        return next(err);
    }
});

UserSchema.methods.verifyPassword = async function(val) {
    if(await argon2.verify(this.password, val)) {
        return true
    }

    throw new Error('Incorrect Password');
}

mongoose.model('User', UserSchema);
module.exports = mongoose.model('User')