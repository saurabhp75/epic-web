import { redirect, type DataFunctionArgs } from '@remix-run/node'
import { authenticator } from '#app/utils/auth.server'
import { handleMockAction } from '#app/utils/connections.server'
import { ProviderNameSchema } from '#app/utils/connections'

export async function loader() {
	return redirect('/login')
}

export async function action({ request, params }: DataFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)

	await handleMockAction(providerName, request)

	return await authenticator.authenticate(providerName, request)
}
