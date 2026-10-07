require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const { MongoClient, ObjectId } = require('mongodb');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

let donorCollection;
let mongoClient;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is missing. Please add it to your .env file.');
  process.exit(1);
}

function serializeDonor(donor) {
  if (!donor) return donor;
  return {
    ...donor,
    _id: donor._id ? donor._id.toString() : donor._id,
  };
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

function validateDonor(data) {
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  const bloodGroup = String(data.bloodGroup || '').trim();
  const city = String(data.city || '').trim();
  const available = data.available !== undefined ? Boolean(data.available) : true;

  if (!name) return 'Please enter donor name.';
  if (!phone) return 'Please enter donor phone number.';
  if (!/^\d{10,15}$/.test(phone)) return 'Please enter a valid phone number.';
  if (!bloodGroup) return 'Please select a blood group.';
  if (!city) return 'Please enter donor city.';

  return { name, phone, bloodGroup, city, available };
}

async function connectDatabase() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    donorCollection = mongoClient.db().collection('donors');
    console.log('Connected to MongoDB Atlas successfully.');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/donors', async (req, res) => {
  try {
    if (!donorCollection) {
      return sendError(res, 500, 'Database is not ready yet.');
    }

    const donors = await donorCollection.find({}).sort({ createdAt: -1 }).toArray();
    const formattedDonors = donors.map(serializeDonor);

    return res.json({
      success: true,
      donors: formattedDonors,
    });
  } catch (error) {
    console.error('Error getting donors:', error);
    return sendError(res, 500, 'Unable to fetch donors right now.');
  }
});

app.post('/api/donors', async (req, res) => {
  try {
    const validationResult = validateDonor(req.body);

    if (validationResult === 'Please enter donor name.' || validationResult === 'Please enter donor phone number.' || validationResult === 'Please enter a valid phone number.' || validationResult === 'Please select a blood group.' || validationResult === 'Please enter donor city.') {
      return sendError(res, 400, validationResult);
    }

    const donorData = validationResult;
    const donor = {
      name: donorData.name,
      phone: donorData.phone,
      bloodGroup: donorData.bloodGroup,
      city: donorData.city,
      available: donorData.available,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await donorCollection.insertOne(donor);
    const savedDonor = serializeDonor({ ...donor, _id: result.insertedId });

    io.emit('donor:created', savedDonor);

    return res.status(201).json({
      success: true,
      message: 'Donor registered successfully',
      donor: savedDonor,
    });
  } catch (error) {
    console.error('Error creating donor:', error);
    return sendError(res, 500, 'Unable to register donor.');
  }
});

app.put('/api/donors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return sendError(res, 400, 'Invalid donor ID.');
    }

    const updateData = { ...req.body };

    if (updateData.name !== undefined && String(updateData.name).trim() === '') {
      return sendError(res, 400, 'Please enter donor name.');
    }

    if (updateData.phone !== undefined) {
      const phone = String(updateData.phone).trim();
      if (!phone) return sendError(res, 400, 'Please enter donor phone number.');
      if (!/^\d{10,15}$/.test(phone)) return sendError(res, 400, 'Please enter a valid phone number.');
      updateData.phone = phone;
    }

    if (updateData.bloodGroup !== undefined && String(updateData.bloodGroup).trim() === '') {
      return sendError(res, 400, 'Please select a blood group.');
    }

    if (updateData.city !== undefined && String(updateData.city).trim() === '') {
      return sendError(res, 400, 'Please enter donor city.');
    }

    if (updateData.available !== undefined) {
      updateData.available = Boolean(updateData.available);
    }

    if (Object.keys(updateData).length === 0) {
      return sendError(res, 400, 'No donor data provided for update.');
    }

    const updateFields = {
      ...updateData,
      updatedAt: new Date(),
    };

    const result = await donorCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      return sendError(res, 404, 'Donor not found.');
    }

    const updatedDonor = serializeDonor(result);
    io.emit('donor:updated', updatedDonor);

    return res.json({
      success: true,
      message: 'Donor updated successfully',
      donor: updatedDonor,
    });
  } catch (error) {
    console.error('Error updating donor:', error);
    return sendError(res, 500, 'Unable to update donor.');
  }
});

app.delete('/api/donors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return sendError(res, 400, 'Invalid donor ID.');
    }

    const deletedDonor = await donorCollection.findOneAndDelete({ _id: new ObjectId(id) });

    if (!deletedDonor) {
      return sendError(res, 404, 'Donor not found.');
    }

    io.emit('donor:deleted', { id });

    return res.json({
      success: true,
      message: 'Donor deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting donor:', error);
    return sendError(res, 500, 'Unable to delete donor.');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('A browser connected via Socket.IO');

  socket.on('disconnect', () => {
    console.log('A browser disconnected');
  });
});

async function startServer() {
  await connectDatabase();

  server.listen(PORT, () => {
    console.log(`Blood Donor Management app is running on http://localhost:${PORT}`);
  });
}

startServer();

process.on('SIGINT', async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});
