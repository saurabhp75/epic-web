import bcrypt from 'bcryptjs'

export { bcrypt }

// 🐨 create a SESSION_EXPIRATION_TIME variable here
// 🐨 export a simple function that returns a new date that's the current time plus the SESSION_EXPIRATION_TIME
const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30
export const getSessionExpirationDate = () =>
	new Date(Date.now() + SESSION_EXPIRATION_TIME)