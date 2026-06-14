// RULE ENGINE — your defensible core.
// Pure, deterministic. Converts the AI's condition grade into the routing
// decision. When a judge asks "how does it decide?", you point HERE — not at
// a black box. This is what answers the trust challenge in the theme.

// Categories where a fully-functional, lightly-used item is worth more to a
// nearby owner than as refurb-resale inventory — route to peer-to-peer
// exchange instead of certified refurbish.
const EXCHANGE_CATEGORIES = ['electronics', 'home'];

function route({ category, condition_grade, confidence, used_as_new_risk }) {
  if (category === 'not_a_product') {
    return { decision: 'NOT_A_PRODUCT', priceFactor: 0, creditsMult: 0,
      reason: 'Image does not show a sellable product — re-upload a clear photo of the returned item.' };
  }

  if (confidence < 50) {
    return { decision: 'INSPECT', priceFactor: 0, creditsMult: 1,
      reason: 'Low confidence on condition — routed to manual inspection queue.' };
  }

  let r;
  switch (condition_grade) {
    case 'A':
      r = { decision: 'RESELL', priceFactor: 0.85, creditsMult: 1,
        reason: 'Like-new condition — return to marketplace at near-full value.' };
      break;
    case 'B':
      r = EXCHANGE_CATEGORIES.includes(category)
        ? { decision: 'EXCHANGE', priceFactor: 0.60, creditsMult: 1.3,
            reason: 'Fully functional, lightly used — list for peer-to-peer exchange near the original owner instead of refurb resale.' }
        : { decision: 'REFURBISH', priceFactor: 0.60, creditsMult: 1.5,
            reason: 'Light wear, fully functional — refurbish and resell as certified.' };
      break;
    case 'C':
      r = { decision: 'DONATE', priceFactor: 0, creditsMult: 2,
        reason: 'Usable but below resale grade — routed to donation partner.' };
      break;
    default:
      r = { decision: 'RECYCLE', priceFactor: 0, creditsMult: 1,
        reason: 'Beyond repair — recover materials through recycling.' };
  }

  // Return-fraud guard: a Grade-A item that looks used (claimed "new") is
  // downgraded to refurbish instead of full resale. Folds the best idea from
  // the counterfeit/returns work into routing.
  if (r.decision === 'RESELL' && used_as_new_risk) {
    r = { decision: 'REFURBISH', priceFactor: 0.60, creditsMult: 1.5,
      reason: 'Looks used despite "new" return — downgraded to certified refurbish.' };
  }

  return r;
}

module.exports = { route };
