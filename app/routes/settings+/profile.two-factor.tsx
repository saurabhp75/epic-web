import { Outlet } from '@remix-run/react'
import { Icon } from '#app/components/ui/icon'
import { type VerificationTypes } from '#app/routes/_auth+/verify'
import { type BreadcrumbHandle } from './profile'
import { type SEOHandle } from '@nasa-gcn/remix-seo'

// export a twoFAVerificationType constant set to '2fa'
// make it type-safer by adding "satisifes VerificationTypes"
export const twoFAVerificationType = '2fa' satisfies VerificationTypes

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="lock-closed">2FA</Icon>,
	getSitemapEntries: () => null,
}

export default function TwoFactorRoute() {
	return <Outlet />
}
