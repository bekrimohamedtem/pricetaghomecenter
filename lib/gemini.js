import { CLE_GEMINI } from "../cle.js";
import { sansTitreCategorie } from "./logic.js";

function cleGemini() {
  return CLE_GEMINI || "";
}

const MODELES = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-pro-latest",
  "gemini-3.1-pro-preview",
  "gemini-omni-flash-preview",
  "gemini-omni-1.1-flash",
];

function messageErreur(status, body) {
  return `${status} ${typeof body === "string" ? body : JSON.stringify(body)}`;
}

function est503(status, texte) {
  const bas = texte.toLowerCase();
  return status === 503 || bas.includes("unavailable") || bas.includes("high demand");
}

function estQuota(status, texte) {
  const bas = texte.toLowerCase();
  return (
    status === 429 ||
    bas.includes("quota") ||
    bas.includes("resource_exhausted") ||
    bas.includes("resource exhausted") ||
    bas.includes("rate limit") ||
    bas.includes("exceeded")
  );
}

function estInutilisable(status, texte) {
  const bas = texte.toLowerCase();
  return (
    status === 404 ||
    bas.includes("not found") ||
    bas.includes("no longer available") ||
    bas.includes("not supported")
  );
}

function promptArticle(designation, reference) {
  return `
    Étiquette de prix. Le client doit comprendre vite.
    5 lignes maximum. Chaque ligne est courte : un fait, pas une phrase.
    Interdit : explications, adjectifs inutiles, "haute précision", "fluidité parfaite", "pour améliorer".
    Pas de titre, pas de puce, pas d'introduction.
    N'écris jamais le type ni la catégorie en première ligne
    (Téléviseur, Réfrigérateur, Congélateur, Lave-vaisselle, Lave-linge,
    Micro-ondes, Plaque, Four, Hotte, Climatiseur, Barre de son).
    Commence directement par la première caractéristique.
    Adapte les chiffres à cet article. Ne recopie pas un autre produit.

    Article : ${designation}
    Référence : ${reference}

    Style à suivre, version courte :

    Dimensions (LxHxP) : [cm] (avec/sans pied)
Taille & Dalle : [Taille en pouces]'' / [HD / Full HD / 4K UHD] / [LED / QLED / OLED]
Fréquence & Image : [60 Hz / 120 Hz / 144 Hz] + [HDR10 / Dolby Vision]
Son : [Puissance en Watts] / [Dolby Audio / Dolby Atmos / DTS]
Smart TV : [Android TV / Google TV / VIDAA / Tizen / webOS]
Connectivité : [Nb ports HDMI] + [Nb ports USB] + [Wi-Fi / Bluetooth]

Dimensions (HxLxP) : [cm]
Capacité / Volume : Volume total [X] L (Réfrigérateur : [Y] L / Congélateur : [Z] L)
Technologie de froid : [NoFrost / DeFrost / Statique]
Compresseur & Bruit : [Inverter / Standard] - [Niveau sonore en dB]
Équipements & Options : [Porte réversible / Zone fraîcheur / Distributeur d'eau]
Classe énergétique : [A+ / A++ / A+++ / Classe T]

Dimensions (HxLxP ou LxPxH) : [cm]
Type & Format : [Horizontal (Coffre) / Vertical (Armoire)]
Volume : [Volume Net / Brut en Litres]
Performances : Pouvoir de congélation [X kg/24h] / Autonomie en coupure [Y heures]
Fonctions & Froid : [NoFrost / Statique] / [Convertible Réfrigérateur-Congélateur]
Classe énergétique & Bruit : [Classe A / A+] - [Niveau sonore en dB]

Dimensions (HxLxP) : [cm]
Capacité & Pose : [Nombre de couverts] couverts / [Encastrable ou Pose libre]
Consommation d'eau : [Litres par cycle]
Programmes & Options : [Nombre de programmes] / [Programme Rapide / Démarrage différé]
Moteur & Séchage : [Inverter / Bras multidirectionnels / Ouverture de porte automatique]
Classe énergétique & Bruit : [A++ / A+++] - [Niveau sonore en dB]

Dimensions (HxLxP) : [cm]
Capacité & Type : [Lavage X kg / Séchage Y kg] / [Hublot ou Chargement par le haut]
Vitesse d'essorage : [660 / 1200 / 1400 tr/min]
Moteur & Technologies : [Inverter Direct Drive / Smart Inverter] + [Option Vapeur]
Programmes & Connectivité : [Nombre de programmes] + [Wi-Fi / Application mobile]
Classe énergétique & Bruit : [A++ / A+++] - [Niveau sonore en dB]

Dimensions (HxLxP) : [cm] (Appareil) / [cm] (Niche d'encastrement)
Volume & Cavité : [Volume en Litres] / [Cavité Inox / Émail]
Type & Puissance : [Solo / Gril / Combiné] - [Puissance Micro-ondes W / Gril W]
Niveaux & Programmes : [Nombre de niveaux de puissance] / [Nombre de programmes auto]
Fonctions & Nettoyage : [Décongélation automatique / Minuterie / Hydrolyse]

Dimensions (LxHxP) : [cm]
Puissance & Canaux : [Puissance totale en Watts RMS] / [Canaux 2.1 / 3.1.1 / 5.1.3 / 9.1.5]
Caisson de basses : [Intégré / Caisson sans fil séparé]
Technologies audio : [Dolby Atmos / DTS:X / Dolby Digital / AI Sound]
Connectivité : [Bluetooth / HDMI eARC / Optique / USB / Wi-Fi]

Dimensions (HxLxP) : [cm] (Appareil) / [cm] (Niche d'encastrement)
Type & Surface : [Gaz / Induction / Vitrocéramique] - [Verre trempé / Inox]
Nombre de foyers : [2 / 4 / 5 feux] (dont brûleur Wok si présent)
Puissance totale : [Watts ou kW]
Équipements & Sécurité : [Grilles en fonte / Allumage 1 main / Sécurité thermocouple]

Dimensions (HxLxP) : [cm] (Appareil) / [cm] (Encastrement)
Volume & Type : [Volume en Litres] / [Électrique ou Gaz / Multifonction]
Modes de cuisson : [Chaleur tournante / Chaleur pulsée / Convection / Gril] - [Nb modes]
Système de nettoyage : [Pyrolyse / Catalyse / Hydrolyse]
Sécurité & Accessoires : [Porte froide / Rails télescopiques / Tournebroche]
Classe énergétique : [A / A+]

Dimensions (HxLxP) : [cm]
Type & Design : [Murale / Pyramidale / Casquette / Encastrable / Inclinaison verre]
Débit d'aspiration : [Débit max en m³/h]
Moteur & Vitesses : [Nombre de vitesses] (+ Mode Booster)
Mode de fonctionnement : [Évacuation ou Recirculation] + [Filtres alu / Filtre à charbon]
Éclairage & Bruit : [Lampes LED / Halogènes] - [Niveau sonore en dB]
  `;
}

async function appelerModele(cle, modele, prompt) {
  const reponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${encodeURIComponent(cle)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  const corps = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const err = new Error(messageErreur(reponse.status, corps.error?.message || corps));
    err.status = reponse.status;
    throw err;
  }
  const texte = corps.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return texte;
}

export async function genererDescription(designation, reference) {
  const cle = cleGemini();
  if (!cle.trim()) {
    const err = new Error("Écris ta clé dans web/cle.js");
    err.status = 500;
    throw err;
  }
  const prompt = promptArticle(designation, reference);
  let derniere = "Réponse vide.";
  let seulementQuota = true;

  for (const modele of MODELES) {
    for (let essai = 1; essai <= 5; essai += 1) {
      try {
        const brut = await appelerModele(cle, modele, prompt);
        const texte = sansTitreCategorie(brut);
        if (texte) return { description: texte, modele };
        derniere = `${modele} : Réponse vide.`;
        seulementQuota = false;
        break;
      } catch (error) {
        const status = error.status || 0;
        const texte = String(error.message || error);
        derniere = `${modele} : ${texte}`;
        if (est503(status, texte) && essai < 5) {
          await new Promise((resoudre) => setTimeout(resoudre, 2000));
          continue;
        }
        if (estQuota(status, texte) || est503(status, texte) || estInutilisable(status, texte)) {
          if (!estQuota(status, texte)) seulementQuota = false;
          break;
        }
        throw error;
      }
    }
  }

  const err = new Error(
    seulementQuota
      ? `Quota terminé sur tous les modèles Gemini.\nDernière réponse : ${derniere}`
      : `Aucun modèle n'a pu générer la description.\nDernière réponse : ${derniere}`
  );
  err.status = 429;
  throw err;
}
