import { redirect } from "next/navigation";

import { McqForm } from "@/components/mcq/mcq-form";
import { SESSION_CLEAR_PATH } from "@/lib/auth-constants";
import { getCurrentUser } from "@/lib/session";

export default async function NewMcqPage() {
	const user = await getCurrentUser();

	if (!user) {
		redirect(SESSION_CLEAR_PATH);
	}

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
			<h1 className="font-heading text-2xl font-medium">Create question</h1>
			<McqForm mode="create" />
		</main>
	);
}
