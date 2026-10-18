import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

async function socialUser({ provider, providerId, name, email, photo }) {
  if (!email) throw new Error(`${provider} did not provide an email address. Use email and password to create your account.`);
  const providerField = 'googleId';
  let user = await User.findOne({ $or: [{ [providerField]: providerId }, { email: email.toLowerCase().trim() }] });
  if (!user) user = new User({ name: name || email.split('@')[0], email: email.toLowerCase().trim(), [providerField]: providerId, profileImage: photo || '' });
  else {
    if (user[providerField] && user[providerField] !== providerId) throw new Error('This email is already connected to a different social account.');
    user[providerField] = providerId;
    if (photo && !user.profileImage) user.profileImage = photo;
  }
  await user.save();
  return user;
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.find((item) => item.verified !== false)?.value;
      done(null, await socialUser({ provider: 'google', providerId: profile.id, name: profile.displayName, email, photo: profile.photos?.[0]?.value }));
    } catch (error) { done(error); }
  }));
}

export default passport;
