/** The one station-ID grammar used by checkpoints, sortie receipts and
 * generated rock cells. Keep all persistent station identifiers here: a
 * captured industrial node is a legal place to dock and save the same run. */
export function validStationId(id){
 return typeof id==='string'&&(/^-?\d+:-?\d+$/.test(id)||
  /^industry:(source|depot)$/.test(id)||
  /^frontier:(azure|teal):(source|depot)$/.test(id));
}
