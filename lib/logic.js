export function celluleTexte(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return celluleTexte(value.richText.map((part) => part.text || "").join(""));
    }
    if ("result" in value && value.result != null) return celluleTexte(value.result);
    if ("text" in value && value.text != null) return celluleTexte(value.text);
  }
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "nan") return "";
  const compact = text.replace(/\s/g, "").replace(",", ".");
  const number = Number(compact);
  if (
    Number.isFinite(number) &&
    !/[eE]/.test(text) &&
    Number.isInteger(number) &&
    compact !== ""
  ) {
    return String(number);
  }
  return text;
}

export function xmlSafe(value) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

export function sansTitreCategorie(texte) {
  const lignes = String(texte || "").trim().split(/\r?\n/);
  while (lignes.length) {
    const premiere = lignes[0].trim().replace(/^[-•*]\s*/, "");
    if (!premiere) {
      lignes.shift();
      continue;
    }
    if (premiere.includes(":")) {
      const [gauche, ...reste] = premiere.split(":");
      const droite = reste.join(":");
      if (droite.trim() || gauche.trim().length > 40) break;
      lignes.shift();
      continue;
    }
    if (premiere.length <= 40 && ![...premiere].some((c) => c >= "0" && c <= "9")) {
      lignes.shift();
      continue;
    }
    break;
  }
  return lignes.join("\n").trim();
}

function sansAccent(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tailleSelonArticle(designation) {
  const texte = ` ${sansAccent(designation)} `;
  const grands = [
    " climatiseur",
    " climatisation",
    " clim ",
    " split",
    " televiseur",
    " television",
    " tv ",
    " refrigerateur",
    " congelateur",
    " lave-vaisselle",
    " lave vaisselle",
    " lave-linge",
    " lave linge",
    " machine a laver",
  ];
  if (grands.some((mot) => texte.includes(mot))) return "large";
  const moyens = [
    " micro-ondes",
    " micro ondes",
    " microondes",
    " plaque",
    " table de cuisson",
    " hotte",
  ];
  if (moyens.some((mot) => texte.includes(mot))) return "medium";
  return "small";
}

export function tailleEffective(designation, choix) {
  if (choix === "large" || choix === "medium" || choix === "small") return choix;
  return tailleSelonArticle(designation);
}

export function iaAutorisee(designation) {
  const taille = tailleSelonArticle(designation);
  return taille === "large" || taille === "medium";
}

export function estColonnePromo(nom) {
  const compact = String(nom || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  return compact.includes("promo");
}

export function cleRef(ref) {
  return celluleTexte(ref).toLowerCase();
}
