import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMemberSchema, type AddMemberInput } from "@teamboard/shared";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ApiError } from "../../lib/api";
import { useAddMember, useSearchUsers } from "./useProjects";

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND:
    "No account uses that email yet. They need to register first.",
  ALREADY_MEMBER: "That person is already a member of this project.",
};

export default function AddMemberDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [debounced, setDebounced] = useState("");
  const mutation = useAddMember(projectId);

  const form = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: "" },
  });
  const emailValue = form.watch("email");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(emailValue.trim()), 250);
    return () => clearTimeout(timer);
  }, [emailValue]);

  const { data: suggestions } = useSearchUsers(debounced);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { member } = await mutation.mutateAsync(values);
      toast.success(`${member.name} added to the project`);
      form.reset();
      setOpen(false);
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? (ERROR_MESSAGES[error.code] ?? error.message)
          : "Could not add that person. Please try again.",
      );
    }
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset();
      setServerError(null);
      setDebounced("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        Add member
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
            <DialogDescription>
              Search for a registered teammate by name or email.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Label htmlFor="member-email">Email</Label>
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="member-email"
                type="email"
                className="pl-8"
                placeholder="teammate@example.com"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}

            {suggestions && suggestions.length > 0 ? (
              <ul
                className="max-h-40 overflow-y-auto rounded-lg border bg-popover p-1"
                aria-label="Matching people"
              >
                {suggestions.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent"
                      onClick={() =>
                        form.setValue("email", user.email, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <span className="text-sm font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {serverError ? (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
