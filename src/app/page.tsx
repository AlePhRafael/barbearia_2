import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  Scissors,
  Star,
  Clock,
  ShieldCheck,
  Coffee,
  Sparkles,
  Check,
  Eye,
  Flame,
  MapPin,
} from "lucide-react";
import hero from "@/assets/hero.png";
import { barberImages, money } from "@/data/presentation";
import { Catalog, parseCatalog, request } from "@/lib/api";
export const dynamic = "force-dynamic";
const icons = [Scissors, Flame, Sparkles, Eye];
export default async function Home() {
  let catalog: Catalog = { services: [], barbers: [] };
  let catalogError = false;
  try {
    catalog = await request(
      `${process.env.API_INTERNAL_URL || "http://127.0.0.1:8000"}/api/catalog`,
      parseCatalog,
      { signal: AbortSignal.timeout(5000) },
    );
  } catch {
    catalogError = true;
  }
  const { services } = catalog;
  const barbers = catalog.barbers.map((b) => ({
    ...b,
    image: barberImages[b.id],
  }));
  return (
    <main>
      <section className="hero">
        <Image
          src={hero}
          alt="Poltrona de couro e espelhos no ambiente acolhedor da Vértice"
          fill
          priority
          sizes="100vw"
          className="hero-image"
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <span className="eyebrow">
            <span /> TRADIÇÃO NO OFÍCIO. ATITUDE NO ESTILO.
          </span>
          <h1>
            Seu estilo.
            <br />
            Em outro <em>nível.</em>
          </h1>
          <p>
            Mais que um corte, um momento seu.
            <br />
            Precisão, personalidade e cuidado em cada detalhe.
          </p>
          <div className="hero-buttons">
            <Link className="button" href="/agendar">
              Agendar meu horário <ArrowUpRight size={19} />
            </Link>
            <Link className="button outline" href="#servicos">
              Conhecer os serviços <ArrowRight size={17} />
            </Link>
          </div>
          <div className="social-proof">
            <div className="avatars">
              {barbers.map(
                (b) =>
                  b.image && (
                    <Image
                      key={b.id}
                      src={b.image}
                      alt=""
                      width={38}
                      height={38}
                    />
                  ),
              )}
            </div>
            <div>
              <span className="stars">
                ★★★★★ <strong>4,9</strong>
              </span>
              <small>Mais de 200 clientes bem cuidados</small>
            </div>
          </div>
        </div>
        <div className="hero-caption">
          <span className="tiny-line" /> O SEU TEMPO MERECE ESSE CUIDADO.
        </div>
        <span className="hero-number">
          01 <span>/ 03</span>
        </span>
      </section>
      <div className="benefit-strip">
        <div className="container benefits">
          <span>
            <Scissors /> Profissionais que entendem de estilo
          </span>
          <span>
            <ShieldCheck /> Cuidado em cada detalhe
          </span>
          <span>
            <Coffee /> Café, conversa e um tempo pra você
          </span>
          <span>
            <Clock /> Seu horário respeitado
          </span>
        </div>
      </div>
      <section id="servicos" className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FEITO PRA VOCÊ</span>
            <h2>O cuidado que você merece.</h2>
            <p>Escolha o seu ritual. O resto, deixa com a gente.</p>
          </div>
          <Link href="/agendar" className="text-link">
            Ver todos os serviços <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="service-grid">
          {catalogError && (
            <p role="alert">
              Não foi possível carregar os serviços. Verifique se o sistema está
              iniciado e recarregue a página.
            </p>
          )}
          {!catalogError && !services.length && (
            <p>Nenhum serviço disponível.</p>
          )}
          {services.map((s, i) => {
            const Icon = icons[i] || Scissors;
            return (
              <Link
                href={`/agendar?servico=${s.id}`}
                key={s.id}
                className={`service-card ${i === 2 ? "featured" : ""}`}
              >
                {i === 2 && <span className="popular">MAIS PEDIDO</span>}
                <div className="service-icon">
                  <Icon size={27} strokeWidth={1.4} />
                </div>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <div className="service-meta">
                  <span>
                    <Clock size={13} /> {s.duration} min
                  </span>
                  <strong>{money(s.price)}</strong>
                </div>
                <span className="service-cta">
                  Escolher serviço <ArrowUpRight size={17} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <section id="equipe" className="section team-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TALENTO QUE FAZ A DIFERENÇA</span>
              <h2>Boas mãos. Grandes estilos.</h2>
              <p>Conheça quem vai cuidar da sua próxima versão.</p>
            </div>
            <span className="quiet-note">
              Experiência, técnica e personalidade.
            </span>
          </div>
          <div className="team-grid">
            {barbers.map((b, i) => (
              <Link href="/agendar" className="team-card" key={b.id}>
                <div className="portrait">
                  <Image
                    src={b.image}
                    alt={b.name}
                    fill
                    sizes="(max-width: 700px) 90vw, 33vw"
                  />
                  <span className="portrait-number">0{i + 1}</span>
                  <span className="portrait-arrow">
                    <ArrowUpRight />
                  </span>
                </div>
                <div className="team-info">
                  <div>
                    <h3>{b.name}</h3>
                    <p>{b.specialty}</p>
                  </div>
                  <span>
                    <Star size={14} fill="currentColor" /> {b.rating}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section id="espaco" className="section container space-grid">
        <div className="space-photo">
          <Image
            src={hero}
            alt="Interior da barbearia com decoração de madeira e iluminação quente"
            fill
            sizes="(max-width: 700px) 100vw, 50vw"
          />
        </div>
        <div className="space-copy">
          <span className="eyebrow">SINTA-SE EM CASA</span>
          <h2>
            Uma pausa na rotina.
            <br />
            Um encontro com você.
          </h2>
          <p>
            Um ambiente pensado para desacelerar. Sente na cadeira, tome um café
            e deixe o cuidado com a gente. Aqui, cada detalhe tem propósito.
          </p>
          <div className="space-features">
            <span>
              <Check size={16} /> Ambiente climatizado
            </span>
            <span>
              <Check size={16} /> Café por nossa conta
            </span>
            <span>
              <Check size={16} /> Atendimento com hora marcada
            </span>
          </div>
          <div className="address">
            <MapPin size={20} />
            <span>
              Vila Madalena · São Paulo
              <small>Segunda a sábado, das 9h às 19h</small>
            </span>
          </div>
        </div>
      </section>
      <section className="container final-cta">
        <div>
          <span className="eyebrow">SEU PRÓXIMO BOM MOMENTO</span>
          <h2>A sua melhor versão tem hora marcada.</h2>
          <p>Escolha seu serviço e reserve seu lugar na cadeira.</p>
        </div>
        <Link href="/agendar" className="button">
          Vamos agendar? <ArrowUpRight size={19} />
        </Link>
      </section>
    </main>
  );
}
