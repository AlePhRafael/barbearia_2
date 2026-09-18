"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Scissors,
  ArrowUpRight,
  Menu,
  X,
  MapPin,
  Clock,
  Camera,
} from "lucide-react";
import { useState } from "react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Vértice Barbearia — início">
      <span className="brand-icon">
        <Scissors size={25} />
      </span>
      <span>
        VÉRTICE<small>BARBEARIA</small>
      </span>
    </Link>
  );
}
export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="container header-inner">
        <Brand />
        <nav className={open ? "nav open" : "nav"} aria-label="Principal">
          <Link
            onClick={() => setOpen(false)}
            className={pathname === "/" ? "active" : ""}
            href="/"
          >
            Início
          </Link>
          <Link onClick={() => setOpen(false)} href="/#servicos">
            Serviços
          </Link>
          <Link onClick={() => setOpen(false)} href="/#equipe">
            Nossa equipe
          </Link>
          <Link onClick={() => setOpen(false)} href="/#espaco">
            O espaço
          </Link>
        </nav>
        <div className="header-actions">
          <Link className="staff-link" href="/login">
            Área da equipe <ArrowUpRight size={14} />
          </Link>
          <Link className="button small" href="/agendar">
            Agendar horário <ArrowUpRight size={15} />
          </Link>
          <button
            className="menu-button"
            aria-label="Abrir menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <Brand />
        <p>Mais que um corte. A sua melhor versão.</p>
        <a href="https://www.instagram.com/" aria-label="Camera">
          <Camera size={20} />
        </a>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} Vértice Barbearia
        </span>
        <span>
          <MapPin size={13} /> São Paulo, SP
        </span>
        <span>
          <Clock size={13} /> Seg–Sáb, 9h às 19h
        </span>
      </div>
    </footer>
  );
}
