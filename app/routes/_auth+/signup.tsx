import {
	redirect,
	type DataFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form } from '@remix-run/react'
import { Button } from '#app/components/ui/button'
import { Input } from '#app/components/ui/input'
import { Label } from '#app/components/ui/label'
import { checkHoneypot } from '#app/utils/honeypot.server'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { validateCSRF } from '#app/utils/csrf.server'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	// 🐨 throw a 400 response if the name field is filled out
	// we'll implement signup later
	checkHoneypot(formData)
	return redirect('/')
}

export default function SignupRoute() {
	return (
		<div className="container flex min-h-full flex-col justify-center pb-32 pt-20">
			<div className="mx-auto w-full max-w-lg">
				<div className="flex flex-col gap-3 text-center">
					<h1 className="text-h1">Welcome aboard!</h1>
					<p className="text-body-md text-muted-foreground">
						Please enter your details.
					</p>
				</div>
				<Form
					method="POST"
					className="mx-auto flex min-w-[368px] max-w-sm flex-col gap-4"
				>
					<AuthenticityTokenInput />
					{/* 🐨 render a hidden div with an "name" input */}
					{/* 🦉 think about the accessibility implications. */}
					{/* make sure screen readers will ignore this field */}
					{/* add a label to tell the user to not fill out
						the field in case they somehow notice it.
					*/}
					<HoneypotInputs />
					<div>
						<Label htmlFor="email-input">Email</Label>
						<Input autoFocus id="email-input" name="email" type="email" />
					</div>
					<Button className="w-full" type="submit">
						Create an account
					</Button>
				</Form>
			</div>
		</div>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Setup Epic Notes Account' }]
}
