"use client";

import { useActionState } from "react";

import { deleteMcqAction, type McqFormState } from "@/lib/actions/mcq-actions";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function DeleteMcqDialog({
	mcqId,
	open,
	onOpenChange,
}: {
	mcqId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [, formAction, pending] = useActionState<McqFormState, FormData>(deleteMcqAction, {});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete question</DialogTitle>
					<DialogDescription>
						This question will be permanently deleted, including its choices and
						attempts. This cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<form action={formAction}>
						<input type="hidden" name="id" value={mcqId ?? ""} />
						<Button type="submit" variant="destructive" disabled={pending || !mcqId}>
							Delete
						</Button>
					</form>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
