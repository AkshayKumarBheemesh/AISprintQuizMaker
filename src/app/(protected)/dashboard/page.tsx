import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { McqTable } from "@/components/mcq/mcq-table";
import { SESSION_CLEAR_PATH } from "@/lib/auth-constants";
import { getCurrentUser } from "@/lib/session";
import { listMcqs } from "@/lib/services/mcq-service";

export default async function DashboardPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect(SESSION_CLEAR_PATH);
	}

	const items = await listMcqs(user.id);

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-heading text-2xl font-medium">MCQ Home</h1>
					<p className="text-muted-foreground">
						{user.firstName} {user.lastName}
					</p>
				</div>
				<LogoutButton />
			</div>

			<McqTable items={items} />
		</main>
	);
}
