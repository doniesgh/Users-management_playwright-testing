
const User = require('../models/userModel');
const Disponibility = require('../models/disponibility');

const getUTCMidnight = () => {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { startOfDay, endOfDay };
};

const getUsersWithDisponibility = async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getUTCMidnight();

    const users = await User.find({ role: { $in: ['TECHNICIEN', 'HELPDESK', 'HELPTECH'] } });

    const userDisponibilities = await Promise.all(
      users.map(async (user) => {
        const disponibility = await Disponibility.findOne({
          user: user._id,
          date: { $gte: startOfDay, $lte: endOfDay }
        });

        return {
          ...user.toObject(),
          isAvailable: disponibility ? disponibility.isAvailable : false,
        };
      })
    );

    return res.status(200).json(userDisponibilities);
  } catch (error) {
    console.error("Erreur getUsersWithDisponibility :", error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs', error });
  }
};

const updateDisponibilityStatus = async (req, res) => {
  const { userId, isAvailable } = req.body;

  try {
    const { startOfDay } = getUTCMidnight();

    let disponibility = await Disponibility.findOne({
      user: userId,
      date: startOfDay
    });

    if (disponibility) {
      disponibility.isAvailable = isAvailable;
      await disponibility.save();
    } else {
      disponibility = new Disponibility({
        user: userId,
        date: startOfDay, // stockée en 00:00:00 UTC
        isAvailable,
      });
      await disponibility.save();
    }

    return res.status(200).json({ message: 'Disponibilité mise à jour avec succès', disponibility });
  } catch (error) {
    console.error("Erreur updateDisponibilityStatus :", error);
    return res.status(500).json({ message: 'Erreur lors de la mise à jour de la disponibilité', error });
  }
};

const countTechHelpDisponible = async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getUTCMidnight();

    const disponibles = await Disponibility.find({
      isAvailable: true,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).populate({
      path: 'user',
      match: { role: { $in: ['TECHNICIEN', 'HELPTECH', 'HELPDESK'] } },
    });

    const count = disponibles.filter(d => d.user !== null).length;

    return res.status(200).json({ count });
  } catch (error) {
    console.error("Erreur countTechHelpDisponible :", error);
    return res.status(500).json({ message: 'Erreur lors du comptage des techniciens disponibles', error });
  }
};

module.exports = { getUsersWithDisponibility, updateDisponibilityStatus , countTechHelpDisponible 
    };