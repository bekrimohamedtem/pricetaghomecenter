"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TagSheet from "./TagSheet";
import { cleRef, iaAutorisee, tailleEffective } from "@/lib/logic";

const STOCKAGE = "hc_articles_coches";

function lireSelection() {
  try {
    const brut = JSON.parse(localStorage.getItem(STOCKAGE) || "{}");
    const selection = {};
    for (const article of Object.values(brut)) {
      if (!article || typeof article !== "object" || !article.ref) continue;
      const cle = cleRef(article.ref);
      selection[cle] = {
        cle,
        ref: article.ref,
        designation: article.designation || "",
        price: String(article.price ?? ""),
        oldPrice: String(article.oldPrice ?? article.old_price ?? ""),
        isPromo: Boolean(article.isPromo ?? article.is_promo),
        size: article.size || "small",
        hasDescription: article.hasDescription ?? article.has_description ?? true,
        description: article.description || "",
        descriptionExcel: article.descriptionExcel ?? article.description_excel ?? "",
        modele: article.modele || article.modele_gen || "",
      };
    }
    return selection;
  } catch {
    return {};
  }
}

function ecrireSelection(selection) {
  const brut = {};
  for (const [cle, item] of Object.entries(selection)) {
    brut[cle] = {
      ref: item.ref,
      designation: item.designation,
      price: item.price,
      old_price: item.oldPrice,
      is_promo: item.isPromo,
      size: item.size,
      has_description: item.hasDescription,
      description: item.description,
      description_excel: item.descriptionExcel,
      modele_gen: item.modele,
    };
  }
  localStorage.setItem(STOCKAGE, JSON.stringify(brut));
}

function depuisCatalogue(article, tailleDefaut) {
  const enPromo = Boolean(article.promo);
  const cle = cleRef(article.ref);
  return {
    cle,
    ref: article.ref,
    designation: article.designation,
    price: enPromo ? article.promo : article.price,
    oldPrice: enPromo ? article.price : "",
    isPromo: enPromo,
    size: tailleEffective(article.designation, tailleDefaut),
    hasDescription: true,
    description: article.description || "",
    descriptionExcel: article.description || "",
    modele: "",
  };
}

export default function PriceApp() {
  const [articles, setArticles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurPage, setErreurPage] = useState("");
  const [recherche, setRecherche] = useState("");
  const [tailleDefaut, setTailleDefaut] = useState("");
  const [selection, setSelection] = useState({});
  const [pret, setPret] = useState(false);
  const [fichier, setFichier] = useState(null);
  const [rapport, setRapport] = useState(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const feuille = useRef(null);
  const taillePrecedente = useRef("");

  useEffect(() => {
    setSelection(lireSelection());
    setPret(true);
    fetch("/api/catalog")
      .then(async (reponse) => {
        const data = await reponse.json();
        if (!reponse.ok) throw new Error(data.error);
        setArticles(data.articles || []);
      })
      .catch((error) => setErreurPage(error.message))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => {
    if (pret) ecrireSelection(selection);
  }, [selection, pret]);

  useEffect(() => {
    if (taillePrecedente.current === tailleDefaut) return;
    taillePrecedente.current = tailleDefaut;
    setSelection((actuel) => {
      const suivant = {};
      for (const [cle, item] of Object.entries(actuel)) {
        suivant[cle] = { ...item, size: tailleEffective(item.designation, tailleDefaut) };
      }
      return suivant;
    });
  }, [tailleDefaut]);

  const filtre = recherche.trim().toLowerCase();
  const filtres = useMemo(() => {
    if (!filtre) return articles;
    return articles.filter(
      (article) =>
        article.designation.toLowerCase().includes(filtre) ||
        article.ref.toLowerCase().includes(filtre)
    );
  }, [articles, filtre]);
  const affiches = filtres.slice(0, 10);
  const clesAffichees = new Set(affiches.map((article) => cleRef(article.ref)));
  const horsListe = Object.values(selection).filter((item) => !clesAffichees.has(item.cle));
  const choisis = Object.values(selection);

  function mettreAJour(cle, patch) {
    setSelection((actuel) => ({ ...actuel, [cle]: { ...actuel[cle], ...patch } }));
  }

  function cocher(article, coche) {
    const cle = cleRef(article.ref);
    setSelection((actuel) => {
      const suivant = { ...actuel };
      if (coche) suivant[cle] = actuel[cle] || depuisCatalogue(article, tailleDefaut);
      else delete suivant[cle];
      return suivant;
    });
  }

  async function sauverDescription(item) {
    if (!item.description.trim() || item.description === item.descriptionExcel) return;
    const reponse = await fetch("/api/description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: item.ref,
        description: item.description,
        designation: item.designation,
        prix: item.isPromo ? item.oldPrice : item.price,
      }),
    });
    const data = await reponse.json();
    if (!reponse.ok) throw new Error(data.error);
    mettreAJour(item.cle, { descriptionExcel: item.description });
    setArticles((liste) =>
      liste.map((article) =>
        cleRef(article.ref) === item.cle ? { ...article, description: item.description } : article
      )
    );
  }

  async function generer(item) {
    setErreur("");
    setMessage("Génération de la fiche technique...");
    try {
      const reponse = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designation: item.designation, reference: item.ref }),
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error);
      const suivant = { ...item, description: data.description, modele: data.modele };
      mettreAJour(item.cle, { description: data.description, modele: data.modele });
      await sauverDescription(suivant);
      setMessage(`Description générée avec ${data.modele}.`);
    } catch (error) {
      setMessage("");
      setErreur(error.message);
    }
  }

  async function comparer() {
    if (!fichier) return;
    setErreur("");
    setMessage("Comparaison du fichier...");
    try {
      const form = new FormData();
      form.append("fichier", fichier);
      const reponse = await fetch("/api/import", { method: "POST", body: form });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error);
      setRapport(data);
      const catalogue = await fetch("/api/catalog").then((r) => r.json());
      setArticles(catalogue.articles || []);
      setMessage(
        `${data.nouveaux.length} nouveau(x), ${data.modifies.length} modifié(s), ${data.identiques} inchangé(s). ${data.absentes} référence(s) absente(s) du fichier : laissées telles quelles.`
      );
    } catch (error) {
      setMessage("");
      setErreur(error.message);
    }
  }

  function selectionnerRapport() {
    if (!rapport?.refs?.length) return;
    const parCle = new Map(articles.map((article) => [cleRef(article.ref), article]));
    setSelection((actuel) => {
      const suivant = { ...actuel };
      for (const ref of rapport.refs) {
        const article = parCle.get(cleRef(ref));
        if (!article) continue;
        const cle = cleRef(article.ref);
        suivant[cle] = actuel[cle] || depuisCatalogue(article, tailleDefaut);
      }
      return suivant;
    });
  }

  function imprimer() {
    if (!feuille.current?.querySelector(".page-a4")) return;
    window.print();
  }

  function panneau(item) {
    const descriptionDejaLa = Boolean(item.description.trim());
    return (
      <div className="panneau">
        <div className="ligne">
          <label>
            Référence
            <input value={item.ref} onChange={(e) => mettreAJour(item.cle, { ref: e.target.value })} />
          </label>
          <label className="champ-large">
            Désignation
            <input
              value={item.designation}
              onChange={(e) => mettreAJour(item.cle, { designation: e.target.value })}
            />
          </label>
          <label>
            Prix TTC (DA)
            <input value={item.price} onChange={(e) => mettreAJour(item.cle, { price: e.target.value })} />
          </label>
        </div>
        <div className="ligne">
          <label>
            Taille de l'étiquette
            <select value={item.size} onChange={(e) => mettreAJour(item.cle, { size: e.target.value })}>
              <option value="large">Grand (5.72" × 4.07")</option>
              <option value="medium">Moyen (6.04" × 2.17")</option>
              <option value="small">Petit (4.25" × 1.9")</option>
            </select>
          </label>
          <label>
            Description
            <select
              value={item.hasDescription ? "oui" : "non"}
              onChange={(e) => mettreAJour(item.cle, { hasDescription: e.target.value === "oui" })}
            >
              <option value="oui">Avec description</option>
              <option value="non">Sans description</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={item.isPromo}
              onChange={(e) => mettreAJour(item.cle, { isPromo: e.target.checked })}
            />
            En promotion
          </label>
          {item.isPromo ? (
            <label>
              Ancien prix (DA)
              <input value={item.oldPrice} onChange={(e) => mettreAJour(item.cle, { oldPrice: e.target.value })} />
            </label>
          ) : null}
        </div>
        {item.hasDescription ? (
          <>
            {descriptionDejaLa ? (
              <p className="aide">
                Description déjà présente. L'IA ne la remplace pas : tu peux seulement la modifier à la main.
              </p>
            ) : !iaAutorisee(item.designation) ? (
              <p className="aide">Pour cet article, la description se saisit seulement à la main.</p>
            ) : (
              <button type="button" className="btn btn-primary btn-ia" onClick={() => generer(item)}>
                Générer via Gemini
              </button>
            )}
            {item.modele ? <p className="aide">Générée avec {item.modele}.</p> : null}
            <textarea
              rows={5}
              value={item.description}
              onChange={(e) => mettreAJour(item.cle, { description: e.target.value })}
              onBlur={(e) =>
                sauverDescription({ ...item, description: e.target.value }).catch((error) =>
                  setErreur(`Description non enregistrée : ${error.message}`)
                )
              }
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <main>
      <header className="entete">
        <img src="/api/logo" alt="Home Center" className="logo-entete" />
        <div>
          <p className="marque">Home Center</p>
          <h1>Étiquettes de prix</h1>
          <p className="chapo">Grand, moyen et petit format, prêts à imprimer.</p>
        </div>
      </header>

      <section className="carte outils">
        <label>
          Taille par défaut
          <select value={tailleDefaut} onChange={(e) => setTailleDefaut(e.target.value)}>
            <option value="">Automatique</option>
            <option value="large">Grand</option>
            <option value="medium">Moyen</option>
            <option value="small">Petit</option>
          </select>
        </label>
        <label className="recherche">
          Rechercher
          <input
            value={recherche}
            placeholder="Désignation ou référence"
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>
      </section>
      {!tailleDefaut ? (
        <p className="aide">
          Grand : clim, TV, réfrigérateur, congélateur, lave-vaisselle, lave-linge. Moyen : micro-ondes,
          plaque, hotte. Petit : le reste.
        </p>
      ) : null}
      {chargement ? <p className="ok">Chargement du catalogue...</p> : null}
      {erreurPage ? <p className="erreur">{erreurPage}</p> : null}
      {!chargement && !erreurPage ? (
        <p className="compteur">
          <span>
            <strong>{articles.length}</strong> articles dans le catalogue
          </span>
          <span>
            {Math.min(filtres.length, 10)} affichés sur {filtres.length}
          </span>
        </p>
      ) : null}

      <section className="carte">
      <h2>Sélectionner les articles</h2>
      <p className="aide">
        Ajoute un Excel d'articles. Les références nouvelles sont ajoutées au catalogue. Celles qui existent
        déjà sont mises à jour si le prix, la désignation ou le prix promo a changé. La description n'est pas
        comparée. Les références absentes du fichier ne sont pas touchées. Une cellule promo vide n'est pas
        une promotion.
      </p>
      <div className="ligne import">
        <input type="file" accept=".xlsx,.xls" onChange={(e) => setFichier(e.target.files?.[0] || null)} />
        <button type="button" className="btn btn-primary" disabled={!fichier} onClick={comparer}>
          Comparer et mettre à jour
        </button>
      </div>
      {rapport ? (
        <div>
          {rapport.nouveaux?.length ? (
            <>
              <h3>Nouveaux articles</h3>
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th>Prix</th>
                    <th>Prix promo</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.nouveaux.map((ligne) => (
                    <tr key={ligne.Référence}>
                      <td>{ligne.Référence}</td>
                      <td>{ligne.Désignation}</td>
                      <td>{ligne.Prix}</td>
                      <td>{ligne["Prix promo"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          {rapport.modifies?.length ? (
            <>
              <h3>Articles modifiés</h3>
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Modifications</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.modifies.map((ligne) => (
                    <tr key={ligne.Référence}>
                      <td>{ligne.Référence}</td>
                      <td>{ligne.Modifications}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          {rapport.refs?.length ? (
            <button type="button" className="btn btn-primary" onClick={selectionnerRapport}>
              Sélectionner tous les nouveaux et les modifiés
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="liste">
        {affiches.map((article) => {
          const cle = cleRef(article.ref);
          const item = selection[cle];
          const coche = Boolean(item);
          const designation = item?.designation || article.designation;
          const ref = item?.ref || article.ref;
          const prix = item?.price || (article.promo || article.price);
          return (
            <li key={cle} className={coche ? "ligne-on" : ""}>
              <label className="article">
                <input type="checkbox" checked={coche} onChange={(e) => cocher(article, e.target.checked)} />
                <span className="article-texte">
                  <span className="article-nom">{designation}</span>
                  <span className="article-meta">Réf {ref}</span>
                </span>
                <span className="article-prix">{prix} DA</span>
              </label>
              {coche ? panneau(item) : null}
            </li>
          );
        })}
      </ul>

      {horsListe.length ? (
        <>
          <h3>Références ajoutées ou hors de la liste affichée</h3>
          {horsListe.map((item) => (
            <div key={item.cle} className="hors">
              <div className="hors-titre">
                <strong>{item.designation || "Désignation à compléter"}</strong>
                <span className="article-meta">Réf {item.ref}</span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() =>
                  setSelection((actuel) => {
                    const suivant = { ...actuel };
                    delete suivant[item.cle];
                    return suivant;
                  })
                }
              >
                Retirer
              </button>
              </div>
              {panneau(item)}
            </div>
          ))}
        </>
      ) : null}

      </section>

      <div className="barre">
        <p className="ok">
          <strong>{choisis.length}</strong> article{choisis.length > 1 ? "s" : ""} sélectionné{choisis.length > 1 ? "s" : ""}
        </p>
        <button type="button" className="btn btn-ghost" disabled={!choisis.length} onClick={() => setSelection({})}>
          Tout décocher
        </button>
      </div>
      {message ? <p className="ok">{message}</p> : null}
      {erreur ? <p className="erreur">{erreur}</p> : null}

      <section className="carte">
      <div className="carte-titre">
        <h2>Planche d'impression</h2>
        {choisis.length ? (
          <button type="button" className="btn btn-primary" onClick={imprimer}>
            Imprimer
          </button>
        ) : null}
      </div>
      {choisis.length ? (
        <>
        <p className="aide">
          L'impression envoie directement les feuilles A4 (21 × 29,7 cm). Dans la fenêtre, laisse l'échelle
          à 100 % et les marges sur Aucune. Les étiquettes gardent alors leur format.
        </p>
        <div className="apercu">
          <TagSheet items={choisis} sheetRef={feuille} />
        </div>
        </>
      ) : (
        <p className="vide">Coche au moins un article pour préparer ses étiquettes.</p>
      )}
      </section>
    </main>
  );
}
