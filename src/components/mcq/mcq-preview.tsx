"use client";

import { startTransition, useActionState, useState } from "react";

import { recordAttemptAction, type RecordAttemptState } from "@/lib/actions/mcq-actions";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type PreviewChoice = {
	id: string;
	choiceText: string;
};

export type PreviewMcq = {
	id: string;
	name: string;
	question: string;
	choices: PreviewChoice[];
};

export function McqPreview({
	mcq,
}: {
	mcq: PreviewMcq & { choices: Array<PreviewChoice & { isCorrect?: boolean }> };
}) {
	const [state, formAction, pending] = useActionState<
		RecordAttemptState | Record<string, never>,
		FormData
	>(recordAttemptAction, {});
	const [selectedChoiceId, setSelectedChoiceId] = useState("");

	const latest =
		state && "ok" in state
			? state
			: null;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<h2 className="font-heading text-2xl font-medium">{mcq.name}</h2>
				<p>{mcq.question}</p>
			</div>

			<form
				noValidate
				action={formAction}
				onSubmit={(event) => {
					event.preventDefault();
					const data = new FormData();
					data.set("mcqId", mcq.id);
					data.set("choiceId", selectedChoiceId);
					startTransition(() => {
						formAction(data);
					});
				}}
			>
				<RadioGroup
					value={selectedChoiceId}
					onValueChange={setSelectedChoiceId}
					className="flex flex-col gap-3"
				>
					{mcq.choices.map((choice) => (
						<label key={choice.id} className="flex items-center gap-2">
							<RadioGroupItem value={choice.id} />
							<span>{choice.choiceText}</span>
						</label>
					))}
				</RadioGroup>

				<Button type="submit" className="mt-6" disabled={pending || !selectedChoiceId}>
					Submit
				</Button>
			</form>

			{latest?.ok === true ? (
				<p>{latest.isCorrect ? "Correct" : "Incorrect"}</p>
			) : null}
			{latest?.ok === false ? (
				<p className="text-destructive">{latest.error}</p>
			) : null}
		</div>
	);
}
