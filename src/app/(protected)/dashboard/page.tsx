import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_CLEAR_PATH } from "@/lib/auth-constants";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect(SESSION_CLEAR_PATH);
	}

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-heading text-2xl font-medium">MCQ Home</h1>
					<p className="text-muted-foreground">
						{user.firstName} {user.lastName}
					</p>
				</div>
				<LogoutButton />
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Coming next</CardTitle>
					<CardDescription>
						Quiz features arrive in a later sprint. This page is only a signed-in
						landing.
					</CardDescription>
				</CardHeader>
			</Card>
		</main>
	);
}
