import { getErrorMessage } from './misc'

export async function sendEmail(options: {
	to: string
	subject: string
	html?: string
	text: string
}) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const from = 'hello@epicstack.dev'

	const email = {
		// 🐨 set the from to whatever address you'd like
		from,
		...options,
	}

	// 📜 https://resend.com/docs/api-reference/emails/send-email
	// 🐨 await a fetch call to the resend API: 'https://api.resend.com/emails'
	// 🐨 the body should be JSON.stringify(email)
	// 🐨 the headers should include:
	//   Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
	//   'content-type': 'application/json'
	// 🐨 await the response.json() and store it in a variable called data
	// 🐨 if the response.ok is truthy, then return {status: 'success'}
	// 🐨 otherwise, return {status: 'error', error: getErrorMessage(data)}
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		body: JSON.stringify(email),
		headers: {
			Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
			'content-type': 'application/json',
		},
	})
	const data = await response.json()
	console.log(data)

	if (response.ok) {
		return { status: 'success' } as const
	} else {
		return {
			status: 'error',
			error: getErrorMessage(data),
		} as const
	}
}
