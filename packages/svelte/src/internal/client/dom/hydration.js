import { DEV } from 'esm-env';
import { HYDRATION_END, HYDRATION_START, HYDRATION_ERROR } from '../../../constants.js';
import * as w from '../warnings.js';

/**
 * Use this variable to guard everything related to hydration code so it can be treeshaken out
 * if the user doesn't use the `hydrate` method and these code paths are therefore not needed.
 */
export let hydrating = false;

/** @param {boolean} value */
export function set_hydrating(value) {
	hydrating = value;
}

/**
 * Array of nodes to traverse for hydration. This will be null if we're not hydrating, but for
 * the sake of simplicity we're not going to use `null` checks everywhere and instead rely on
 * the `hydrating` flag to tell whether or not we're in hydration mode at which point this is set.
 * @type {import('#client').TemplateNode[]}
 */
export let hydrate_nodes = /** @type {any} */ (null);

/** @type {import('#client').TemplateNode} */
export let hydrate_start;

/** @param {import('#client').TemplateNode[]} nodes */
export function set_hydrate_nodes(nodes) {
	hydrate_nodes = nodes;
	hydrate_start = nodes && nodes[0];
}

/**
 * When assigning nodes to an effect during hydration, we typically want the hydration boundary comment node
 * immediately before `hydrate_start`. In some cases, this comment doesn't exist because we optimized it away.
 * TODO it might be worth storing this value separately rather than retrieving it with `previousSibling`
 */
export function get_start() {
	return /** @type {import('#client').TemplateNode} */ (
		hydrate_start.previousSibling ?? hydrate_start
	);
}

/**
 * This function is only called when `hydrating` is true. If passed a `<!--[-->` opening
 * hydration marker, it finds the corresponding closing marker and sets `hydrate_nodes`
 * to everything between the markers, before returning the closing marker.
 * @param {Node} node
 * @returns {Node}
 */
export function hydrate_anchor(node) {
	if (node.nodeType !== 8) {
		return node;
	}

	var current = /** @type {Node | null} */ (node);

	// TODO this could have false positives, if a user comment consisted of `[`. need to tighten that up
	if (/** @type {Comment} */ (current).data !== HYDRATION_START) {
		return node;
	}

	/** @type {Node[]} */
	var nodes = [];
	var depth = 0;

	while ((current = /** @type {Node} */ (current).nextSibling) !== null) {
		if (current.nodeType === 8) {
			var data = /** @type {Comment} */ (current).data;

			if (data === HYDRATION_START) {
				depth += 1;
			} else if (data[0] === HYDRATION_END) {
				if (depth === 0) {
					hydrate_nodes = /** @type {import('#client').TemplateNode[]} */ (nodes);
					hydrate_start = /** @type {import('#client').TemplateNode} */ (nodes[0]);
					return current;
				}

				depth -= 1;
			}
		}

		nodes.push(current);
	}

	let location;

	if (DEV) {
		// @ts-expect-error
		const loc = node.parentNode?.__svelte_meta?.loc;
		if (loc) {
			location = `${loc.file}:${loc.line}:${loc.column}`;
		}
	}

	w.hydration_mismatch(location);
	throw HYDRATION_ERROR;
}
