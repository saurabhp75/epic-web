import { json, type DataFunctionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId } from '#app/utils/auth.server'
import { validateCSRF } from '#app/utils/csrf.server'
import { useDoubleCheck, useIsPending } from '#app/utils/misc'
import { redirectWithToast } from '#app/utils/toast.server'
import { prisma } from '#app/utils/db.server'
import { twoFAVerificationType } from './profile.two-factor'
import { getRedirectToUrl } from '../_auth+/verify'
import { shouldRequestTwoFA } from '../_auth+/login'

export const handle = {
	breadcrumb: <Icon name="lock-open-1">Disable</Icon>,
}

export async function requireRecentVerification({
	request,
	userId,
}: {
	request: Request
	userId: string
}) {
	const shouldReverify = await shouldRequestTwoFA({ request, userId })

	// if we should reverify, then get a verification URL and redirect
	if (shouldReverify) {
		const reqUrl = new URL(request.url)
		const redirectUrl = getRedirectToUrl({
			request,
			target: userId,
			type: twoFAVerificationType,
			redirectTo: reqUrl.pathname + reqUrl.search,
		})
		throw await redirectWithToast(redirectUrl.toString(), {
			title: 'Please Reverify',
			description: 'Please reverify your account before proceeding',
		})
	}
}

export async function loader({ request }: DataFunctionArgs) {
	await requireRecentVerification({
		request,
		userId: await requireUserId(request),
	})
	return json({})
}

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)

	await requireRecentVerification({ request, userId })

	const formData = await request.formData()
	await validateCSRF(formData, request.headers)

	await prisma.verification.delete({
		where: { target_type: { target: userId, type: twoFAVerificationType } },
	})

	throw await redirectWithToast('/settings/profile/two-factor', {
		title: '2FA Disabled',
		type: 'success',
		description: 'Two factor authentication has been disabled.',
	})
}

export default function TwoFactorDisableRoute() {
	const isPending = useIsPending()
	const dc = useDoubleCheck()

	return (
		<div className="mx-auto max-w-sm">
			<Form method="POST">
				<AuthenticityTokenInput />
				<p>
					Disabling two factor authentication is not recommended. However, if
					you would like to do so, click here:
				</p>
				<StatusButton
					variant="destructive"
					status={isPending ? 'pending' : 'idle'}
					disabled={isPending}
					{...dc.getButtonProps({
						className: 'mx-auto',
						name: 'intent',
						value: 'disable',
						type: 'submit',
					})}
				>
					{dc.doubleCheck ? 'Are you sure?' : 'Disable 2FA'}
				</StatusButton>
			</Form>
		</div>
	)
}
