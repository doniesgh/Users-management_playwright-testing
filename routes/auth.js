// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/userModel'); 

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token ou mot de passe manquant' });
  }

  try {
    const user = await User.findOne({ resetToken: token });

    if (!user) {
      return res.status(400).json({ message: 'Token invalide ou expiré' });
    }
    if (user.resetTokenExpires < Date.now()) {
      return res.status(400).json({ message: 'Token expiré' });
    }

    // **Directement enregistrer le mot de passe en clair**
    user.password = newPassword;

    // Supprime le token et sa date d'expiration
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;

    await user.save();

    res.status(200).json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
