import { saveUserName } from "@/app/actions";

export function UserNameForm() {
  return (
    <form action={saveUserName} className="mt-7 space-y-4">
      <label className="block text-sm font-semibold">
        Seu nome
        <input
          autoComplete="name"
          autoFocus
          className="field mt-1.5"
          maxLength={60}
          name="user_name"
          placeholder="Ex.: Matheus"
          required
        />
      </label>
      <button className="button-primary w-full" type="submit">
        Continuar
      </button>
    </form>
  );
}
