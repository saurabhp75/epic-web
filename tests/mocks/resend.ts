// 🐨 create and export handlers here
// 🦺 the type is Array<HttpHandler>
import { faker } from '@faker-js/faker'
import { HttpResponse, http, type HttpHandler } from 'msw'
import { z } from 'zod'

// 🐨 handle http.post requests to `https://api.resend.com/emails`
// 🐨 get the body from await request.json()
// 💯 as extra credit, make this typesafe by parsing it with zod
// 🐨 log out the email body
const { json } = HttpResponse

// 🐨 return json with the following properties: id, from, to, created_at
// 💰 you can use faker to generate the id and new Date().toISOString() for the created_at
const EmailSchema = z.object({
	to: z.string(),
	from: z.string(),
	subject: z.string(),
	text: z.string(),
	html: z.string().optional(),
})

export const handlers: Array<HttpHandler> = [
	http.post(`https://api.resend.com/emails`, async ({ request }) => {
		const body = EmailSchema.parse(await request.json())
		console.info('🔶 mocked email contents:', body)

		return json({
			id: faker.string.uuid(),
			from: body.from,
			to: body.to,
			created_at: new Date().toISOString(),
		})
	}),
]
