import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Check, FileText, Search, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/workspace/ui";
import "./landing.css";

export const metadata: Metadata = {
  title: "applyAmigo | Bewerbungen mit Überblick",
  description: "Passende Stellen sammeln, Bewerbungen aus deinem Profil vorbereiten und jeden nächsten Schritt im Blick behalten. Du entscheidest, was eingereicht wird.",
};
const faqs = [
  ["Verschickt applyAmigo Bewerbungen für mich?", "Nein. Du erstellst und prüfst Entwürfe im Workspace. Einreichen kannst du sie anschließend selbst über die Originalanzeige. Auch eine Freigabe in applyAmigo löst keinen Versand aus."],
  ["Woher kommen die Stellen?", "Du kannst Stellen manuell hinzufügen oder ausgewählte Karriereportale verbinden. Aktuell werden Ashby, Greenhouse, Lever und Personio unterstützt. Aktualisiert wird auf deinen Klick. Das ist keine Suche über das gesamte Internet."],
  ["Wie funktioniert die Profilpassung?", "Die App gleicht dein Profil mit den Angaben einer Stelle ab, etwa Fähigkeiten, Standort und Arbeitszeit. Fehlende Angaben bleiben sichtbar. Die Punkte sind eine Orientierung und keine Wahrscheinlichkeit für eine Zusage."],
  ["Kann ich meinen Lebenslauf hochladen?", "Du kannst deinen Lebenslauf als Text einfügen oder eine TXT- beziehungsweise Markdown-Datei verwenden. PDF-Dateien werden derzeit nicht automatisch ausgelesen. Aus deinen Angaben entstehen bearbeitbare Anschreiben, noch keine fertig gestalteten Lebenslauf-PDFs."],
  ["Brauche ich einen KI-Zugang?", "Die Vorlagen funktionieren ohne KI-Anbieter. Optionale KI-Entwürfe benötigen einen eingerichteten Modellzugang und deine Zustimmung zur Nutzung für die konkrete Bewerbung. Wenn KI-Texte verboten sind, bleibt diese Funktion gesperrt."],
  ["Ist applyAmigo Open Source?", "Ja. Der Quellcode ist unter der MIT-Lizenz verfügbar. Du kannst ihn einsehen und selbst betreiben. Für eine eigene Installation brauchst du eigenes Hosting und eine sichere Anmeldung. Betrieb und optionale Modellaufrufe können Kosten verursachen."],
];
// Section composition adapted from Mckay's App Template (MIT).
// Exact source revision and retained copyright notice: THIRD_PARTY_NOTICES.md.
export default function Home() {
  return <div className="landing">
    <a className="skip-link" href="#landing-content">Zum Inhalt</a>
    <header className="landing-header">
      <a href="/" aria-label="applyAmigo Startseite"><Logo /></a>
      <nav aria-label="Produktnavigation"><a href="#ablauf">Ablauf</a><a href="#funktionen">Funktionen</a><a href="#fragen">Fragen</a></nav>
      <a className="button button-primary" href="/dashboard">Workspace öffnen <ArrowUpRight size={16}/></a>
    </header>
    <main id="landing-content">
      <section className="landing-hero landing-width">
        <div className="hero-copy"><span className="landing-kicker">DEIN BEWERBUNGSWORKSPACE</span>
          <h1>Mehr Zeit für<br/>die richtige <em>Stelle.</em></h1>
          <p>Behalte passende Stellen und deine Bewerbungen an einem Ort. Nutze dein Profil für den nächsten Entwurf, statt jedes Mal von vorne anzufangen.</p>
          <div className="landing-actions"><a className="button button-primary" href="/dashboard">Bewerbungen organisieren <ArrowRight size={18}/></a><a className="landing-text-link" href="#ablauf">So funktioniert’s</a></div>
          <span className="hero-assurance"><ShieldCheck size={17}/> Kein automatischer Versand. Du gibst den Inhalt frei.</span>
        </div>
        <div className="product-preview" aria-label="Illustrative Produktvorschau mit fiktiven Beispielen">
          <div className="preview-bar"><Logo small/><span>Produktbeispiel</span></div>
          <div className="preview-body"><div className="preview-heading"><h2>Deine Bewerbungen</h2><span>2 Entwürfe</span></div>
            <div className="preview-job"><div><small>BEISPIEL · ROBOTIK</small><strong>Werkstudent Robotics</strong><span>München · Teilzeit</span></div><span className="preview-status">Entwurf</span></div>
            <div className="preview-job"><div><small>BEISPIEL · SOFTWARE</small><strong>Software Engineering</strong><span>Hybrid · Werkstudent</span></div><span className="preview-status">Entwurf</span></div>
            <div className="preview-draft"><div><FileText size={17}/><strong>Vor dem Einreichen</strong></div><p><Check size={15}/> Angaben mit dem Profil abgleichen</p><p><Check size={15}/> Anschreiben persönlich anpassen</p><p className="preview-pending"><span/> Inhalt prüfen und freigeben</p></div>
          </div>
          <div className="preview-footer"><ShieldCheck size={14}/> Entwürfe bleiben unter deiner Kontrolle.</div>
        </div>
      </section>
      <div className="source-strip"><div className="landing-width"><span>Stellen aus verbundenen Karriereportalen</span><div><strong>Ashby</strong><strong>Greenhouse</strong><strong>Lever</strong><strong>Personio</strong></div><small>Oder jede Stelle selbst hinzufügen.</small></div></div>
      <section id="ablauf" className="landing-section landing-width">
        <div className="landing-section-heading"><span className="landing-kicker">DER ABLAUF</span><h2>Vom ersten Fund<br/>zum geprüften Entwurf.</h2><p>Jede Bewerbung hat einen nächsten Schritt. applyAmigo hilft dir, ihn festzuhalten.</p></div>
        <ol className="workflow-steps">
          <li><span>01</span><div><h3>Dein Profil als Grundlage</h3><p>Hinterlege Erfahrungen und belegbare Projekte. Diese Angaben kannst du für weitere Bewerbungen wiederverwenden.</p></div></li>
          <li><span>02</span><div><h3>Stellen prüfen und auswählen</h3><p>Sammle interessante Ausschreibungen. Vergleiche die Anforderungen mit deinem Profil und prüfe offene Punkte.</p></div></li>
          <li><span>03</span><div><h3>Vorbereiten, dann selbst einreichen</h3><p>Bearbeite deinen Entwurf und plane Zeit für die Bewerbung. Nach deiner Prüfung reichst du sie im Originalportal ein.</p></div></li>
        </ol>
      </section>
      <section id="funktionen" className="feature-section"><div className="landing-width">
        <div className="landing-section-heading"><span className="landing-kicker">IM WORKSPACE</span><h2>Die Details bleiben<br/>bei der Bewerbung.</h2></div>
        <div className="feature-layout"><div className="feature-index"><Search size={27}/><h3>Weniger zusammensuchen.</h3><p>Stellenbeschreibung, persönliche Notizen und Entwürfe sind direkt miteinander verbunden.</p><a href="/dashboard/stellen" className="landing-text-link">Stellenbereich öffnen <ArrowRight size={16}/></a></div>
          <dl className="feature-list"><div><dt>Status mit Überblick</dt><dd>Von der Merkliste bis zum Gespräch. Du hältst fest, wo jede Bewerbung steht.</dd></div><div><dt>Entwürfe aus deinen Angaben</dt><dd>Vorlagen für Software, Robotics und Research. Auf Deutsch oder Englisch, jederzeit bearbeitbar.</dd></div><div><dt>Zeit für genau eine Bewerbung</dt><dd>Plane feste Arbeitsblöcke für die nächsten 14 Tage. Fristen stehen direkt bei der Stelle.</dd></div><div><dt>Deine Daten zum Mitnehmen</dt><dd>Exportiere den Workspace als JSON oder ein Anschreiben als Text.</dd></div></dl>
        </div>
      </div></section>
      <section id="fragen" className="landing-section landing-width faq-layout"><div className="landing-section-heading"><span className="landing-kicker">GUT ZU WISSEN</span><h2>Bevor du loslegst.</h2><p>Was heute funktioniert und wo du selbst entscheidest.</p></div><div className="landing-faq">{faqs.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className="landing-cta landing-width"><div><h2>Deine nächste Bewerbung<br/>beginnt mit deinem Profil.</h2><p>Öffne deinen Workspace und halte den ersten Schritt fest.</p></div><a className="button button-primary" href="/dashboard/unterlagen">Profil hinterlegen <ArrowRight size={18}/></a></section>
    </main>
    <footer className="landing-footer landing-width"><a href="/" aria-label="applyAmigo Startseite"><Logo small/></a><span>Open Source · Bewerbungen mit Überblick</span><a href="https://github.com/Amerigo2020/applyAmigo" target="_blank" rel="noopener noreferrer">Quellcode auf GitHub <ArrowUpRight size={15}/></a></footer>
  </div>;
}
