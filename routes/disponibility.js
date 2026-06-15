const express = require('express');
const {  countTechHelpDisponible,
     updateDisponibilityStatus,getUsersWithDisponibility } = require('../controllers/disponibilityController');
const router = express.Router();
router.get('/', getUsersWithDisponibility);
router.post('/update', updateDisponibilityStatus);
router.get('/nbHelpTechDispo', countTechHelpDisponible);
module.exports = router;
