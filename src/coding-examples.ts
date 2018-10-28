/**
 * This file implements a Sourcegraph extension for displaying coding examples.
 * Mike Hewett  27 Oct 2018
 * www.github.com/mhewett
 */
import { ajax } from 'rxjs/ajax';
import * as sourcegraph from 'sourcegraph';
import {TextDocument} from 'sourcegraph';
const goIndex = require('./goIndex.json');

interface FullSettings {
    'show-documentation': boolean;
    'show-example': boolean;
    'provider.go.host': string;
    'provider.go.port': string;
}

type Settings = Partial<FullSettings>;

const DEFAULT_GO_EXAMPLE_SERVER_HOST = 'localhost';
const DEFAULT_GO_EXAMPLE_SERVER_PORT = '8844';

/**
 * Returns the token under the mouse.
 * This code was borrowed from https://github.com/sourcegraph/sourcegraph-extension-samples/blob/master/token-highlights/src/extension.ts
 */
function getTokenAt(doc: TextDocument, pos: sourcegraph.Position): string | null {

    const line:string = doc.text.split('\n')[pos.line];

    const leftMatches:RegExpExecArray  | null = /\w+$/.exec(line.slice(0, pos.character));
    const rightMatches:RegExpExecArray | null = /^\w+/.exec(line.slice(pos.character));

    if (!leftMatches && !rightMatches) {
        return null;
    } else if (!leftMatches) {
        return rightMatches && rightMatches[0];
    } else if (!rightMatches) {
        return leftMatches && leftMatches[0];
    } else {
        return leftMatches[0] + rightMatches[0];
    }
}

/**
 * Looks up the Go package for the given symbol.
 * @param symbol a class or function such as MultiReader
 */
function getGoPackageFor(symbol: string|null): string {
    const entry = symbol && goIndex[symbol];
    if (entry) {
        return entry.split('.').join('/');
    } else {
        return '';
    }
}

/**
 * This is required for a Sourcegraph extension.
 * It creates the extension and registers the hover provider that returns results when called.
 */
export function activate(): void {

    function afterActivate(): void {
        const goHost = sourcegraph.configuration.get<Settings>().get('provider.go.host') || DEFAULT_GO_EXAMPLE_SERVER_HOST;
        const goPort = sourcegraph.configuration.get<Settings>().get('provider.go.port') || DEFAULT_GO_EXAMPLE_SERVER_PORT;
        // const showDocumentation = sourcegraph.configuration.get<Settings>().get('show-documentation');
        // const showExample = sourcegraph.configuration.get<Settings>().get('show-example');

        const docSelector = [{pattern: '*.{go}'}];

        sourcegraph.languages.registerHoverProvider(docSelector, {
            provideHover: async (doc, pos) => {

                // Get the object being hovered on.
                const funcOrClass = getTokenAt(doc, pos);
                const pkg = getGoPackageFor(funcOrClass);

                return ajax({
                    method: 'GET',
                    url: `http://${goHost}:${goPort}/go/${pkg}/${funcOrClass}?format=text`,
                    responseType: 'text/plain',
                })
                    .toPromise()
                    .then(response =>
                        (
                            response && {
                                contents: {
                                    // Use Go syntax highlighting
                                    value: '```go\n' + response + '\n```',
                                    kind: sourcegraph.MarkupKind.Markdown
                                }
                            }
                        )
                    )
            }
        });
    }

        /*
        sourcegraph.languages.registerDefinitionProvider(docSelector, {
            provideDefinition: async (doc, pos) => {
                return ajax({
                    method: 'POST',
                    url: address,
                    body: JSON.stringify({ method: 'definition', doc, pos }),
                    responseType: 'json',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                    .toPromise()
                    .then(response => {
                        return (
                            response &&
                            response.response.definition &&
                            new sourcegraph.Location(
                                new sourcegraph.URI(doc.uri),
                                new sourcegraph.Range(
                                    new sourcegraph.Position(
                                        response.response.definition.start.line,
                                        response.response.definition.start.character
                                    ),
                                    new sourcegraph.Position(
                                        response.response.definition.end.line,
                                        response.response.definition.end.character
                                    )
                                )
                            )
                        )
                    })
            },
        })
    }
    */

    // Error creating extension host: Error: Configuration is not yet available.
    // `sourcegraph.configuration.get` is not usable until after the extension
    // `activate` function is finished executing. This is a known issue and will
    // be fixed before the beta release of Sourcegraph extensions. In the
    // meantime, work around this limitation by deferring calls to `get`.
    setTimeout(afterActivate, 0);
}
