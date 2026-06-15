const bcrypt = require('bcryptjs')
const User = require('../models/userModel')
const Disponibility = require('../models/disponibility')
const jwt = require('jsonwebtoken')
const ConnectionLog = require('../models/connectionLog')
const mongoose = require('mongoose')

const createToken = (user) => {
  return jwt.sign(
    { _id: user._id, role: user.role },
    process.env.SECRET
  );
};
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
const getTechHelpList = async (req, res) => {
  try {
    const roles =  'HELPTECH';

    // Step 1: Find users with specific roles
    const users = await User.find(
      { role: { $in: roles } },
      { _id: 1, firstname: 1, lastname: 1, role: 1 }
    );

    if (users.length === 0) {
      res.status(200).json([]);
    }
    if (users.length > 0) {
      res.status(200).json(users);
    }
    else {
      res.status(404).json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const loginWithOTP = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.login(email, password); // ✅ now secure

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiresAt = Date.now() + 10 * 60 * 1000;

    await user.save();

    const { subject, html } = sendOTPMail(otp);
    await sendEmail(email, subject, html);

    res.status(200).json({
      message: 'OTP sent to your email. Please verify to continue.'
    });

  } catch (err) {
    console.error("Error during login with OTP:", err);
    res.status(400).json({
      error: 'Login failed. Please check your email and password.'
    });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    // Trouver l'utilisateur et peupler clientName si le rôle est CLIENT
    const user = await User.findOne({ email }).populate('clientName', 'name agence emails').populate('modelesAutorises', 'name'); // Ajout de populate ici

    if (user && user.otp === otp && Date.now() < user.otpExpiresAt) {
      const token = createToken(user._id);
      user.otp = null;
      user.otpExpiresAt = null;
      await user.save();

      try {
        const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString();
        const userAgent = (req.headers['user-agent'] || '').toString();
        await ConnectionLog.create({
          event: 'LOGIN',
          user: user._id,
          email: user.email,
          role: user.role,
          ip,
          userAgent,
        });
      } catch (e) {
        console.error('Failed to create connection log:', e);
      }

      // Si l'utilisateur est un client, inclure clientName dans la réponse
      const response = {
        email,
        token,
        role: user.role,
        id: user._id,
      };


      if (user.role === 'CLIENT' || user.role === 'SUPERCLIENT') {
        response.clientName = user.clientName;
        response.access = user.access;
        response.modelesAutorises = user.modelesAutorises;
      }

      res.status(200).json(response);
    } else {
      res.status(400).json({ error: 'Invalid or expired OTP.' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(400).json({ error: 'OTP verification failed.' });
  }
};
const updateNbrReclamation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // '+1' ou '-1'

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Technicien non trouvé' });
    }

    const currentNbr = user.nbr_reclamation || 0;
    const newNbr = action === '+1' ? currentNbr + 1 : Math.max(0, currentNbr - 1);

    user.nbr_reclamation = newNbr;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Nombre de réclamations ${action === '+1' ? 'augmenté' : 'diminué'}`,
      technicien: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        nbrReclamation: newNbr
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const loginUserMobile = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.login(email, password);
    const token = createToken(user._id);

    res.status(200).json({ email, token, id: user._id });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(400).json({ error: "Login failed. Please check your email and password." });
  }
};


const loginUserMob = async (req, res) => {
  const { email, password, fcmToken, deviceId, appVersion } = req.body; // Extraction de la version de l'app

  console.log("Received login request with:", { email, password, fcmToken, deviceId, appVersion });

  try {
    // Authentification de l'utilisateur
    const user = await User.login(email, password);
    const token = createToken(user._id);
    const { role } = user;

    // Vérification du deviceId
    if (user.deviceId && user.deviceId !== deviceId) {
      return res.status(403).json({ error: "Appareil non autorisé." });
    } else if (!user.deviceId || user.deviceId === "") {
      user.deviceId = deviceId;
      await user.save();
      console.log("Device ID stored successfully:", deviceId);
    }

    // Mise à jour de la version de l'application dans la base de données si nécessaire
    if (user.appVersion !== appVersion) {
      user.appVersion = appVersion; // Mettre à jour la version de l'application
      await user.save();
      console.log("App version updated to:", appVersion);
    }

    // Vérification et mise à jour du fcmToken
    if (fcmToken) {
      if (user.fcmToken !== fcmToken) {
        user.fcmToken = fcmToken;
        await user.save();
        console.log("FCM token updated successfully:", fcmToken);
      }
    } else if (!user.fcmToken) {
      return res.status(400).json({ error: "Erreur 004: FCM token est vide." });
    }

    // Connexion réussie
    res.status(200).json({ email, token, role, id: user._id, appVersion: user.appVersion });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(400).json({ error: "Login failed. Please check your email and password." });
  }
};


const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.login(email, password);
    const token = createToken(user._id);
    const { role } = user;

    res.status(200).json({ email, token, role, id: user._id });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(400).json({ error: "Login failed. Please check your email and password." });
  }
};

const NbClient = async (req, res) => {
  try {
    let count = await User.countDocuments({ role: 'client' });
    count = count || 0;
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const NbHelpDesk = async (req, res) => {
  try {
    let nbHelpDesk = await User.countDocuments({ role: 'HELPDESK' });
    nbHelpDesk = nbHelpDesk || 0;
    res.status(200).json({ count: nbHelpDesk });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const NbTechnicien = async (req, res) => {
  try {
    let nbTechnicien = await User.countDocuments({ role: 'TECHNICIEN' });
    nbTechnicien = nbTechnicien || 0;
    res.status(200).json({ count: nbTechnicien });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }

};
const getUserByRole = async (req, res) => {
  try {
    const userRole = req.params.role;
    const userCount = await User.countDocuments({ role: userRole });
    res.json({ count: userCount });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
}

const signupUser = async (req, res) => {
  const { firstname, lastname, email, password, role } = req.body
  try {
    const user = await User.signup(firstname, lastname, email, password, role)
    const token = createToken(user._id)
    res.status(200).json({ firstname, email, token })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}
const getUsers = async (req, res) => {
  const users = await User.find({})
  res.status(200).json(users)
}
const getUsersByEmail = async (req, res) => {
  const email = req.params.email;
  try {
    const user = await User.findOne({ email: email })
    if (user) {
      res.status(200).json(user)
    } else {
      res.status(404).json({ message: 'User not found' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
};
const updateUserByemail = async (req, res) => {
  const userId = req.params.id;
  const updatedUserData = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updatedUserData, { new: true });

    if (updatedUser) {
      res.status(200).json(updatedUser);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const userId = req.params._id;
    const profile = await User.findOne({ userId });
    res.json(profile);
    console.log("profile:*************************", profile);
  } catch (err) {
    console.error(err);
    res.status(500).send('not found');
  }
}

const deleteUser = async (req, res) => {
  const { id } = req.params

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'No such user' })
  }

  const user = await User.findOneAndDelete({ _id: id })

  if (!user) {
    return res.status(400).json({ error: 'No such user' })
  }

  res.status(200).json(user)
}
// const updateUser = async (req, res) => {
//   const { id } = req.params
//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     return res.status(400).json({ error: 'No such user' })
//   }
//   const user = await User.findById(id)
//   if (!user) {
//     return res.status(400).json({ error: 'No such user' })
//   }
//   const { firstname, lastname, email, password, role, fcmToken, deviceId, numeroTel } = req.body
//   if (!lastname && !firstname && !email && !password && !role && !fcmToken && !deviceId && !numeroTel) {
//     return res.status(400).json({ error: 'Vous devez au moins modifier un champs' })
//   }
//   const updatedUser = await User.findByIdAndUpdate(
//     id,
//     { firstname, lastname, email, password, role, fcmToken, deviceId, numeroTel },
//     { new: true }
//   )
//   res.status(200).json(updatedUser)
// };
const updateUser = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "No such user" });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(400).json({ error: "No such user" });
  }

  const {
    firstname,
    lastname,
    email,
    password,
    role,
    fcmToken,
    deviceId,
    numeroTel,
    access,
    clientName,
    modelesAutorises,
  } = req.body;

  const updateFields = {};

  if (firstname !== undefined) updateFields.firstname = firstname;
  if (lastname !== undefined) updateFields.lastname = lastname;
  if (email !== undefined) updateFields.email = email;
  if (password !== undefined) updateFields.password = password;
  if (role !== undefined) updateFields.role = role;
  if (fcmToken !== undefined) updateFields.fcmToken = fcmToken;
  if (deviceId !== undefined) updateFields.deviceId = deviceId;
  if (numeroTel !== undefined) updateFields.numeroTel = numeroTel;

  // 🔥 NEW FIELDS
  if (access !== undefined) updateFields.access = access;
  if (clientName !== undefined) updateFields.clientName = clientName;
  if (modelesAutorises !== undefined) {
    updateFields.modelesAutorises = modelesAutorises;
  }

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({
      error: "Vous devez au moins modifier un champ",
    });
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    updateFields,
    { new: true }
  );

  res.status(200).json(updatedUser);
};
const getTechHelp = async (req, res) => {
  try {
    const roles = ['TECHNICIEN', 'HELPDESK', 'HELPTECH'];

    // Step 1: Find users with specific roles
    const users = await User.find(
      { role: { $in: roles } },
      { _id: 1, firstname: 1, lastname: 1, role: 1 }
    );

    if (users.length === 0) {
      return res.status(404).json([]);
    }

    // Step 2: Extract user IDs
    const userIds = users.map(user => user._id);

    // Step 3: Define today's date range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Step 4: Find users with `isAvailable: true` and `date` is today in Disponibility
    const availableUserIds = await Disponibility.find(
      {
        user: { $in: userIds },
        isAvailable: true,
        date: { $gte: startOfDay, $lte: endOfDay }
      },
      { user: 1 }
    ).then(docs => docs.map(doc => doc.user.toString()));

    // Step 5: Filter users based on availability
    const availableUsers = users.filter(user => availableUserIds.includes(user._id.toString()));

    if (availableUsers.length > 0) {
      res.status(200).json(availableUsers);
    } else {
      res.status(404).json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProfil = async (req, res) => {
  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'No such user' })
  }
  const user = await User.findById(id)
  if (!user) {
    return res.status(400).json({ error: 'No such user' })
  }
  const { firstname, lastname, email, password } = req.body
  if (!lastname && !firstname && !email && !password) {
    return res.status(400).json({ error: 'Vous devez au moins modifier un champs' })
  }
  const updatedUser = await User.findByIdAndUpdate(
    id,
    { firstname, lastname, email, password },
    { new: true }
  )
  res.status(200).json(updatedUser)
};
// const createUser = async (req, res) => {
//   const { firstname, lastname, email, password, role, clientName, access } = req.body;
//   let emptyFields = [];

//   if (!firstname) emptyFields.push('firstname');
//   if (!lastname) emptyFields.push('lastname');
//   if (!email) emptyFields.push('email');
//   if (!password) emptyFields.push('password');
//   if (!role) emptyFields.push('role');
//   if (role === 'CLIENT' && !clientName) emptyFields.push('clientName');
//   if (role === 'SUPERCLIENT' && !clientName) emptyFields.push('clientName');
//   if (role === 'CLIENT' && !access) emptyFields.push('access');
//   if (role === 'SUPERCLIENT' && !access) emptyFields.push('access');

//   if (emptyFields.length > 0) {
//     return res.status(400).json({ error: 'Veuillez remplir tous les champs.', emptyFields });
//   }

//   try {
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ error: `L'adresse e-mail ${email} est déjà utilisée.` });
//     }

//     // 🔐 HASH PASSWORD HERE
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const userData = {
//       firstname,
//       lastname,
//       email,
//       password: hashedPassword, // save hashed password
//       role
//     };

//     if (role === 'CLIENT' || role === 'SUPERCLIENT') {
//       userData.clientName = clientName;
//       userData.access = access;
//     }

//     const user = await User.create(userData);

//     // ❗ Never send password back
//     user.password = undefined;

//     res.status(200).json(user);

//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

const createUser = async (req, res) => {
  const {
    firstname,
    lastname,
    email,
    password,
    role,
    clientName,
    access,
    modelesAutorises
  } = req.body;

  let emptyFields = [];

  // ───────── REQUIRED FIELDS ─────────
  if (!firstname) emptyFields.push('firstname');
  if (!lastname) emptyFields.push('lastname');
  if (!email) emptyFields.push('email');
  if (!password) emptyFields.push('password');
  if (!role) emptyFields.push('role');

  // ───────── CLIENT / SUPERCLIENT RULES ─────────
  if (role === 'CLIENT' || role === 'SUPERCLIENT') {
    if (!clientName) emptyFields.push('clientName');
    if (!access) emptyFields.push('access');
  }

  if (emptyFields.length > 0) {
    return res.status(400).json({
      error: 'Veuillez remplir tous les champs.',
      emptyFields
    });
  }

  try {
    // ───────── CHECK EMAIL EXISTS ─────────
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: `L'adresse e-mail ${email} est déjà utilisée.`
      });
    }

    // ───────── HASH PASSWORD ─────────
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ───────── USER DATA ─────────
    const userData = {
      firstname,
      lastname,
      email,
      password: hashedPassword,
      role,
    };

    if (role === 'CLIENT' || role === 'SUPERCLIENT') {
      userData.clientName = clientName;
      userData.access = access;

      // ✅ ADD MODELES AUTORISÉS
      if (modelesAutorises && Array.isArray(modelesAutorises)) {
        userData.modelesAutorises = modelesAutorises;
      }
    }

    const user = await User.create(userData);

    // ───────── CLEAN RESPONSE ─────────
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(201).json(userResponse);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
async function uploadAndProcessFile(req, res) {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    for (const row of data) {
      const { firstname, lastname, email, password, role } = row;
      if (!email || !password || !firstname || !lastname || !role) {
        console.error('Invalid data:', row);
        continue;
      }
      try {
        await User.create({ firstname, lastname, email, password, role });
      } catch (error) {
        console.error('Error inserting user:', error.message);
      }
    }

    res.send('Data inserted successfully.');
  } catch (error) {
    console.error('Error reading Excel file:', error.message);
    res.status(500).send('Error processing file.');
  }
}
const path = require('path');
const fs = require('fs');
const importUser = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send({ status: 400, error: 'No file uploaded' });
    }
    const filePath = req.files[0].path;
    console.log('File Path:', filePath);
    if (!filePath.endsWith('.xlsx')) {
      return res.status(400).send({ status: 400, error: 'Uploaded file is not an Excel file' });
    }
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    console.log('Sheet Names:', sheetNames);
    const sheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log('Parsed Excel Data:', data);
    const userData = [];
    for (const record of data) {
      if (record.email && record.password && record.firstname && record.lastname && record.role) {
        userData.push({
          firstname: record.firstname,
          lastname: record.lastname,
          email: record.email,
          password: record.password,
          role: record.role,
          fcmToken: record.fcmToken || '',
        });
      } else {
        console.warn('Skipping invalid record:', record);
      }
    }
    console.log('User Data to Insert:', userData);
    if (userData.length === 0) {
      return res.status(400).send({ status: 400, error: 'No valid data to insert' });
    }
    try {
      await User.insertMany(userData, { ordered: false });
    } catch (error) {
      if (error.code === 11000) {
        console.warn('Duplicate key error, skipping duplicate records:', error.message);
      } else {
        throw error;
      }
    }
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file:', err);
    });

    res.send({ status: 200, success: true, msg: 'Excel file imported successfully' });
  } catch (error) {
    console.error('Import Error:', error);
    res.status(500).send({ status: 500, error: 'Internal server error' });
  }
};


module.exports = { updateNbrReclamation, getTechHelpList, verifyOTP, loginWithOTP, uploadAndProcessFile, importUser, loginUserMob, loginUserMobile, updateUserByemail, updateProfil, getTechHelp, getUserByRole, NbClient, NbHelpDesk, NbTechnicien, loginUser, createUser, signupUser, deleteUser, updateUser, getUsers, getUsersByEmail, getUserById }
