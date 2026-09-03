import { redirect } from "next/navigation";

import { McqPreview } from "@/components/mcq/mcq-preview";
import { SESSION_CLEAR_PATH } from "@/lib/auth-constants";
import { getCurrentUser } from "@/lib/session";
import { getMcq } from "@/lib/services/mcq-service";

export default async function PreviewMcqPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const user = await getCurrentUser();

	if (!user) {
		redirect(SESSION_CLEAR_PATH);
	}

	const { id } = await params;
	const mcq = await getMcq(id, user.id);

	if (!mcq) {
		redirect("/dashboard");
	}

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
			<McqPreview
				mcq={{
					id: mcq.id,
					name: mcq.name,
					question: mcq.question,
					choices: mcq.choices.map((choice) => ({
						id: choice.id,
						choiceText: choice.choiceText,
					})),
				}}
			/>
		</main>
	);
}
