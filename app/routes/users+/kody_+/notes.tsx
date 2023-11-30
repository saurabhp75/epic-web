import { cn } from '#app/utils/misc'
import { Link, NavLink, Outlet } from '@remix-run/react'

export default function NotesRoute() {
	return (
		<div className="flex h-full justify-between pb-12 border-8 border-blue-500">
			<div>
				<h1 className="text-h1">Notes</h1>
				<ul>
					<li>
						<Link to=".." className="underline" relative="path">
							Back to Kody
						</Link>
					</li>
					<li>
						<NavLink
							to="some-note-id"
							className={({ isActive }) =>
								cn('underline', isActive && 'bg-accent')
							}
						>
							Some note
						</NavLink>
					</li>
				</ul>
			</div>
			<Outlet />
		</div>
	)
}
