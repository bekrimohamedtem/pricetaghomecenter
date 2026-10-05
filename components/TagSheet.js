import "../app/tags.css";

function Entete() {
  return (
    <div className="header">
      <img src="/api/logo" alt="Home Center" />
      <div className="agree">
        DISTRIBUTEUR AGRÉÉ
        <br />
        LG
      </div>
    </div>
  );
}

function Titre({ item }) {
  return (
    <div className="designation">
      {item.designation}
      <div className="sku">Réf. {item.ref}</div>
    </div>
  );
}

function Prix({ item, grand }) {
  return (
    <div className="red">
      {item.isPromo ? <div className="promo-pill">Promotion</div> : null}
      {item.isPromo && item.oldPrice ? <div className="old-price">{item.oldPrice} DA</div> : null}
      {grand ? (
        <div className="price">
          {item.price} DA<span className="star">*</span>
        </div>
      ) : (
        <>
          <div className="price">{item.price}</div>
          <div className="currency">
            DA<span className="star">*</span>
          </div>
        </>
      )}
      {grand ? <div className="note">* Prix recommandé</div> : null}
    </div>
  );
}

const TAILLE_MM = {
  large: { w: 5.72 * 25.4, h: 4.07 * 25.4 },
  medium: { w: 6.04 * 25.4, h: 2.17 * 25.4 },
  small: { w: 4.25 * 25.4, h: 1.9 * 25.4 },
};
const PAGE_L = 210;
const PAGE_H = 297;
const MARGE = 8;
const GAP = 4;

function decouperFeuilles(items) {
  const pages = [];
  let page = [];
  let x = MARGE;
  let y = MARGE;
  let hauteurLigne = 0;
  const limiteX = PAGE_L - MARGE;
  const limiteY = PAGE_H - MARGE;

  for (const item of items) {
    const taille = TAILLE_MM[item.size] || TAILLE_MM.small;
    let prochainX = x;
    let prochainY = y;
    let prochaineHauteur = hauteurLigne;
    if (x > MARGE && x + taille.w > limiteX) {
      prochainX = MARGE;
      prochainY = y + hauteurLigne + GAP;
      prochaineHauteur = 0;
    }
    if (prochainY + taille.h > limiteY && page.length) {
      pages.push(page);
      page = [];
      prochainX = MARGE;
      prochainY = MARGE;
      prochaineHauteur = 0;
    }
    page.push(item);
    x = prochainX + taille.w + GAP;
    y = prochainY;
    hauteurLigne = Math.max(prochaineHauteur, taille.h);
  }
  if (page.length) pages.push(page);
  return pages;
}

function Etiquette({ item }) {
  const promo = item.isPromo ? " promo" : "";
  if (item.size === "medium") {
    return (
      <div className={`tag medium${promo}`}>
        <div className="left">
          <Entete />
          <div className="divider" />
          <Titre item={item} />
          {item.hasDescription ? (
            <div className="body">
              <div className="description">{item.description}</div>
            </div>
          ) : null}
        </div>
        <Prix item={item} />
      </div>
    );
  }
  if (item.size === "small") {
    return (
      <div className={`tag small${promo}`}>
        <div className="left">
          <Entete />
          <div className="divider" />
          <Titre item={item} />
        </div>
        <Prix item={item} />
      </div>
    );
  }
  return (
    <div className={`tag large${promo}`}>
      <Entete />
      <div className="divider" />
      <Titre item={item} />
      {item.hasDescription ? (
        <div className="body">
          <div className="description">{item.description}</div>
        </div>
      ) : null}
      <Prix item={item} grand />
    </div>
  );
}

export default function TagSheet({ items, sheetRef }) {
  const pages = decouperFeuilles(items);
  return (
    <div className="planche" ref={sheetRef}>
      {pages.map((page, index) => (
        <div className="feuille-bloc" key={page.map((item) => item.cle).join("-")}>
          <p className="feuille-num">
            Feuille {index + 1} / {pages.length} — A4, 21 × 29,7 cm
          </p>
          <div className="page-a4">
            {page.map((item) => (
              <Etiquette item={item} key={item.cle} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
