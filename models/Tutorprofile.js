const mongoose = require('mongoose');


const imageSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: Number, 
        required: true,
    },
    skill: {
        type: String,
        required: true,
    }
});

module.exports = mongoose.model('Tutorprofile', imageSchema);
