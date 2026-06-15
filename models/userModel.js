const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    firstname: {
        type: String,
    },
    lastname: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    appVersion: {
        type: String,
    },
    deviceId: {
        type: String,
        default: ""
    },
    resetToken: String,
    resetTokenExpires: Date,
    password: {
        type: String,
        required: true,
    },
    nbr_chances: { type: Map, of: Number, default: {} },
    nbr_chances_notified_years: { type: [Number], default: [] },
    role: {
        type: String,
        required: true,
        enum: ['COORDINATRICE', 'HELPTECH', 'ADMIN', 'MANAGER', 'CLIENT', 'SUPERCLIENT']
    },
    adresse_mac: String,
    numeroTel: String,
    fcmToken: String,
    nbr_reclamation: { type: Number, default: 0 },
    clientName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client", // Référence au modèle Client
        required: function () {
            return this.role === "CLIENT" || this.role === "SUPERCLIENT";
        }
    },
    access: {
        type: String,
        enum: ['ALL', 'DAB', 'TRIEUSE'],
        required: function () {
            return this.role === "CLIENT" || this.role === "SUPERCLIENT";
        }
    },
    otp: {
        type: String,
    },
    otpExpiresAt: {
        type: Date,
    },
    modelesAutorises: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Modele"
        }
    ]

});


userSchema.statics.signup = async function (firstname, lastname, email, password, role) {
    if (!email || !password || !firstname || !lastname || !role) {
        throw Error('All fields must be filled');
    }

    if (!validator.isEmail(email)) {
        throw Error('Adresse email est invalide');
    }

    const exists = await this.findOne({ email });
    if (exists) {
        throw Error('Adresse email est déja utilisée');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = await this.create({
        firstname,
        lastname,
        email,
        password: hash, // ✅ store hashed password
        role
    });

    return user;
};


userSchema.statics.login = async function (email, password) {
    if (!email || !password) {
        throw Error('Veuillez remplir tous les champs.');
    }

    const user = await this.findOne({ email });

    if (!user) {
        throw Error('Adresse email est incorrecte');
    }

    let match = false;

    try {
        match = await bcrypt.compare(password, user.password);
    } catch (e) {
        match = false;
    }

    if (!match && user.password === password) {
        match = true;

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
    }

    if (!match) {
        throw Error('Mot de passe incorrect');
    }

    return user;
};
userSchema.statics.findById = async function (id) {
    try {
        const user = await this.findOne({ _id: id });
        if (!user) {
            throw new Error('Utilisateur non trouvé');
        }
        return user;
    } catch (error) {
        throw error;
    }
};

module.exports = mongoose.model('User', userSchema);