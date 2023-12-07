import { z } from 'zod'
import { type ReactElement } from 'react'
import { renderAsync } from '@react-email/components'

const ResendErrorSchema = z.union([
	z.object({
		name: z.string(),
		message: z.string(),
		statusCode: z.number(),
	}),
	z.object({
		name: z.literal('UnknownError'),
		message: z.literal('Unknown Error'),
		statusCode: z.literal(500),
		cause: z.any(),
	}),
])
type ResendError = z.infer<typeof ResendErrorSchema>

const ResendSuccessSchema = z.object({
	id: z.string(),
})

export async function sendEmail({
	react,
	...options
}: {
	to: string
	subject: string
} & (
	| { html: string; text: string; react?: never }
	| { react: ReactElement; html?: never; text?: never }
)) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const from = 'hello@epicstack.dev'

	const email = {
		// 🐨 set the from to whatever address you'd like
		from,
		...options,
		...(react ? await renderReactEmail(react) : null),
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
	// console.log(data)
	const parsedData = ResendSuccessSchema.safeParse(data)

	if (response.ok && parsedData.success) {
		return {
			status: 'success',
			data: parsedData,
		} as const
	} else {
		const parseResult = ResendErrorSchema.safeParse(data)
		if (parseResult.success) {
			return {
				status: 'error',
				error: parseResult.data,
			} as const
		} else {
			return {
				status: 'error',
				error: {
					name: 'UnknownError',
					message: 'Unknown Error',
					statusCode: 500,
					cause: data,
				} satisfies ResendError,
			} as const
		}
	}
}

async function renderReactEmail(react: ReactElement) {
	const [html, text] = await Promise.all([
		renderAsync(react),
		renderAsync(react, { plainText: true }),
	])
	return { html, text }
}
