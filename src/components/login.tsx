"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useApp } from "@/context/app-context";
import { message } from "@/lib/api";
export default function Login() {
  const { login, session, ready } = useApp();
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (ready && session) router.replace("/painel");
  }, [ready, session, router]);
  return (
    <main className="login-page">
      <div className="login-card panel">
        <span className="login-icon">
          <LockKeyhole size={25} />
        </span>
        <span className="eyebrow">NOSSO ESPAÇO DE TRABALHO</span>
        <h1>Bem-vindo de volta.</h1>
        <p>Acesse a área da equipe para cuidar do seu dia.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            setPending(true);
            setError("");
            try {
              await login(user, password);
              router.replace("/painel");
            } catch (error) {
              setError(message(error));
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Usuário
            <input
              autoComplete="username"
              required
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Seu usuário"
            />
          </label>
          <label>
            Senha
            <div className="password-field">
              <input
                autoComplete="current-password"
                required
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
              />
              <button
                type="button"
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button w-full"
            type="submit"
            disabled={pending || !ready}
          >
            {pending ? "Entrando…" : "Entrar no painel"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="demo-note">
          <strong>Acesso da equipe</strong>
          <span>Use a conta cadastrada pelo responsável pela barbearia.</span>
          <small>Sua sessão é encerrada ao sair ou após oito horas.</small>
        </div>
      </div>
    </main>
  );
}
