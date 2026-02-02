import { useBlockProps } from '@wordpress/blockEditor';

/**
 * Generate a short unique ID for gradient/defs
 */
function generateBlockId() {
	return 'esvg-' + Math.random().toString(36).slice(2, 11);
}

/**
 * Convert gradient angle (deg) to SVG linearGradient x1,y1,x2,y2
 */
function angleToGradientCoords(angle) {
	const rad = ((90 - angle) * Math.PI) / 180;
	const x1 = 0.5 - 0.5 * Math.cos(rad);
	const y1 = 0.5 + 0.5 * Math.sin(rad);
	const x2 = 0.5 + 0.5 * Math.cos(rad);
	const y2 = 0.5 - 0.5 * Math.sin(rad);
	return { x1, y1, x2, y2 };
}

/**
 * Process SVG: when useGradient, inject linearGradient and replace fills; otherwise return as-is
 */
function processSvgForLayer(svgCode, options = {}) {
	const { gradientId, gradientStart, gradientEnd, gradientAngle, useGradient } = options;

	if (!svgCode || !svgCode.trim()) return null;

	// Parse viewBox from SVG
	const viewBoxMatch = svgCode.match(/viewBox\s*=\s*["']([^"']+)["']/i);
	const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';

	let processed = svgCode;

	// Ensure viewBox and fill="none" on root svg
	if (!viewBoxMatch) {
		processed = processed.replace(/<svg\s/i, (m) => m + ` viewBox="${viewBox}" `);
	}
	processed = processed.replace(/<svg([^>]*)>/i, (_, attrs) => {
		if (!/fill\s*=/i.test(attrs)) {
			return `<svg${attrs} fill="none">`;
		}
		return `<svg${attrs}>`;
	});

	if (useGradient && gradientId && gradientStart && gradientEnd) {
		const { x1, y1, x2, y2 } = angleToGradientCoords(gradientAngle);
		const gradientDef = `<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${gradientStart}"></stop><stop offset="100%" stop-color="${gradientEnd}"></stop></linearGradient>`;

		if (/<defs>/i.test(processed)) {
			processed = processed.replace(/<defs>/i, `<defs>${gradientDef}`);
		} else {
			processed = processed.replace(/<\/svg>/i, `<defs>${gradientDef}</defs></svg>`);
		}

		// Replace all fill attributes with our gradient
		processed = processed.replace(
			/fill\s*=\s*["'][^"']*["']/gi,
			`fill="url(#${gradientId})"`
		);
		// Add fill for path/circle/rect/ellipse/polygon without fill
		processed = processed.replace(
			/<(path|circle|rect|ellipse|polygon)(\s[^>]*)?>/gi,
			(m, tag, attrs) => {
				if (attrs && /fill\s*=/i.test(attrs)) return m;
				return `<${tag}${attrs || ''} fill="url(#${gradientId})">`;
			}
		);
	}

	return { svg: processed, viewBox };
}

export default function Save({ attributes }) {
	const {
		svgCode,
		width = '3rem',
		height = '3rem',
		blockId,
		outlineColor = '#696969',
		outlineWidth = 1,
		disableOutline,
		gradientStart = '#000000',
		gradientEnd = '#000000',
		gradientAngle = 45,
		useOriginalFill = true,
		reverseHover,
		transitionId,
		alignSelf = 'auto',
		justifySelf = 'auto',
	} = attributes;

	if (!svgCode || !svgCode.trim()) return null;

	const uniqueId = blockId || transitionId || generateBlockId();
	const shortId = uniqueId.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'esvg' + Math.random().toString(36).slice(2, 9);
	const gradientId = 'esvg-grad-esvg-' + shortId;

	const blockProps = useBlockProps.save({
		className: [
			'wp-block-wp-logo-explode-explodesvg',
			'wp-block-explodesvg-container',
			useOriginalFill ? 'has-original-fill' : 'has-custom-gradient',
			reverseHover ? 'reverse-hover' : '',
		]
			.filter(Boolean)
			.join(' '),
		id: blockId || transitionId || undefined,
		style: {
			width,
			height,
			'--esvg-stroke-color': outlineColor,
			'--esvg-stroke-width': `${outlineWidth}px`,
			'--esvg-gradient-ref': useOriginalFill ? undefined : `url(#${gradientId})`,
			position: 'relative',
			display: 'inline-block',
			verticalAlign: 'middle',
			alignSelf: alignSelf !== 'auto' ? alignSelf : undefined,
			justifySelf: justifySelf !== 'auto' ? justifySelf : undefined,
		},
		'data-transition-id': transitionId || undefined,
	});

	const useGradient = !useOriginalFill;
	const { svg: outlineSvg } = processSvgForLayer(svgCode, {
		gradientId,
		gradientStart,
		gradientEnd,
		gradientAngle,
		useGradient,
	});
	const { svg: gradientSvg } = processSvgForLayer(svgCode, {
		gradientId,
		gradientStart,
		gradientEnd,
		gradientAngle,
		useGradient,
	});

	return (
		<div {...blockProps}>
			{!disableOutline && (
				<div className="explodesvg-layer-outline" aria-hidden="true">
					<div dangerouslySetInnerHTML={{ __html: outlineSvg }} />
				</div>
			)}
			<div className="explodesvg-layer-gradient">
				<div dangerouslySetInnerHTML={{ __html: gradientSvg }} />
			</div>
		</div>
	);
}
