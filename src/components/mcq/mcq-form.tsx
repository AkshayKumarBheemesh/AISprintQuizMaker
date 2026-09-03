"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import {
	createMcqAction,
	updateMcqAction,
	type McqFormState,
} from "@/lib/actions/mcq-actions";
import { mcqWriteSchema } from "@/lib/schemas/mcq-schema";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type McqFormValues = z.input<typeof mcqWriteSchema>;

const EMPTY_CHOICES: McqFormValues["choices"] = [
	{ choiceText: "", isCorrect: false },
	{ choiceText: "", isCorrect: false },
];

export function McqForm({
	mode,
	mcqId,
	defaultValues,
	initialState,
}: {
	mode: "create" | "edit";
	mcqId?: string;
	defaultValues?: {
		name: string;
		question: string;
		choices: { id?: string; choiceText: string; isCorrect: boolean }[];
	};
	initialState?: McqFormState;
}) {
	const action = mode === "edit" ? updateMcqAction : createMcqAction;
	const [state, formAction, pending] = useActionState(action, initialState ?? {});

	const form = useForm<McqFormValues>({
		resolver: zodResolver(mcqWriteSchema),
		defaultValues: {
			name: defaultValues?.name ?? "",
			question: defaultValues?.question ?? "",
			choices: defaultValues?.choices ?? EMPTY_CHOICES,
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "choices",
	});

	const [correctValue, setCorrectValue] = useState(() => {
		const index = (defaultValues?.choices ?? EMPTY_CHOICES).findIndex(
			(choice) => choice.isCorrect,
		);
		return index >= 0 ? String(index) : "";
	});

	const fieldError = (name: "name" | "question", server?: string[]) => {
		const client = form.formState.errors[name]?.message;
		const messages = [client, ...(server ?? [])].filter((message): message is string =>
			Boolean(message),
		);
		return messages.map((message) => ({ message }));
	};

	return (
		<form
			noValidate
			action={formAction}
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit((values) => {
					const data = new FormData();
					data.set("name", values.name);
					data.set("question", values.question);
					if (mode === "edit" && mcqId) {
						data.set("id", mcqId);
					}

					values.choices.forEach((choice, index) => {
						data.set(`choices.${index}.choiceText`, choice.choiceText);
						data.set(`choices.${index}.isCorrect`, choice.isCorrect ? "true" : "false");
						if (choice.id) {
							data.set(`choices.${index}.id`, choice.id);
						}
					});

					startTransition(() => {
						formAction(data);
					});
				})(event);
			}}
		>
			{mode === "edit" && mcqId ? <input type="hidden" name="id" value={mcqId} /> : null}

			<FieldSet>
				<FieldGroup>
					<Field data-invalid={Boolean(form.formState.errors.name || state.errors?.name)}>
						<FieldLabel htmlFor="name">Name</FieldLabel>
						<Input
							id="name"
							aria-invalid={Boolean(form.formState.errors.name || state.errors?.name)}
							{...form.register("name")}
						/>
						<FieldError errors={fieldError("name", state.errors?.name)} />
					</Field>

					<Field
						data-invalid={Boolean(form.formState.errors.question || state.errors?.question)}
					>
						<FieldLabel htmlFor="question">Question</FieldLabel>
						<Textarea
							id="question"
							aria-invalid={Boolean(
								form.formState.errors.question || state.errors?.question,
							)}
							{...form.register("question")}
						/>
						<FieldError errors={fieldError("question", state.errors?.question)} />
					</Field>

					<RadioGroup
						value={correctValue}
						onValueChange={(value) => {
							setCorrectValue(value);
							fields.forEach((_, index) => {
								form.setValue(`choices.${index}.isCorrect`, index === Number(value), {
									shouldDirty: true,
									shouldValidate: true,
								});
							});
						}}
					>
						{fields.map((field, index) => (
							<Field key={field.id}>
								<input type="hidden" {...form.register(`choices.${index}.id`)} />
								<FieldLabel htmlFor={`choices.${index}.choiceText`}>
									Choice {index + 1}
								</FieldLabel>
								<div className="flex items-start gap-3">
									<Textarea
										id={`choices.${index}.choiceText`}
										{...form.register(`choices.${index}.choiceText`)}
									/>
									<div className="flex shrink-0 items-center gap-2 pt-2">
										<RadioGroupItem
											value={String(index)}
											aria-label={`Choice ${index + 1} is correct`}
										/>
										<Button
											type="button"
											variant="outline"
											disabled={fields.length <= 2}
											aria-label={`Remove choice ${index + 1}`}
											onClick={() => {
												if (fields.length <= 2) {
													return;
												}
												remove(index);
											}}
										>
											Remove
										</Button>
									</div>
								</div>
							</Field>
						))}
					</RadioGroup>

					{form.formState.errors.choices?.message || state.errors?.choices?.length ? (
						<p className="text-sm text-destructive">
							{form.formState.errors.choices?.message ??
								state.errors?.choices?.join(" ")}
						</p>
					) : null}

					<Button
						type="button"
						variant="outline"
						disabled={fields.length >= 6}
						onClick={() => {
							if (fields.length >= 6) {
								return;
							}
							append({ choiceText: "", isCorrect: false });
						}}
					>
						Add choice
					</Button>
				</FieldGroup>
			</FieldSet>

			<div className="mt-6 flex justify-end gap-3">
				<Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
					Cancel
				</Link>
				<Button type="submit" disabled={pending}>
					Save
				</Button>
			</div>
		</form>
	);
}
