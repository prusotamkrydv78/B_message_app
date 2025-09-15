import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../src/db/connect.js';
import { User } from '../src/models/User.js';
import { Conversation } from '../src/models/Conversation.js';

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await connectDB(uri);

  //console.log('Clearing existing test users (phoneNumber starting with 999)...');
  await User.deleteMany({ phoneNumber: { $regex: /^999/ } });

  const demoUsers = [
    { name: 'Alex', countryCode: '+977', phoneNumber: '9990000001', password: 'password123' },
    { name: 'Sam', countryCode: '+977', phoneNumber: '9990000002', password: 'password123' },
    { name: 'Riya', countryCode: '+977', phoneNumber: '9990000003', password: 'password123' },
    { name: 'Neha', countryCode: '+977', phoneNumber: '9990000004', password: 'password123' },
    { name: 'Aman', countryCode: '+977', phoneNumber: '9990000005', password: 'password123' },
  ];

  const created = [];
  for (const du of demoUsers) {
    const passwordHash = await User.hashPassword(du.password);
    const user = await User.create({
      name: du.name,
      countryCode: du.countryCode,
      phoneNumber: du.phoneNumber,
      passwordHash,
    });
    created.push(user);
  }

  //console.log('Created users:', created.map((u) => `${u.name} (${u.phoneNumber})`).join(', '));

  // Create a couple of sample conversations among the created users
  const [u1, u2, u3] = created;
  await Conversation.deleteMany({});
  await Conversation.create([
    {
      participants: [u1._id, u2._id],
      lastMessage: { text: 'Hey Sam! How are you?', sender: u1._id, at: new Date(Date.now() - 1000 * 60 * 30) },
    },
    {
      participants: [u1._id, u3._id],
      lastMessage: { text: 'Let\'s catch up later', sender: u3._id, at: new Date(Date.now() - 1000 * 60 * 90) },
    },
  ]);

  //console.log('Seed completed.');
  await mongoose.connection.close();
}

main().catch((err) => {
  //console.error(err);
  process.exit(1);
});
