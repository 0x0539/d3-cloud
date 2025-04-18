import * as d3 from "d3";
export = d3.layout.cloud;
declare module "d3" {
    namespace layout {
        export function cloud(): Cloud<cloud.Word>;
        export function cloud<T extends cloud.Word>(): Cloud<T>;
        namespace cloud {
            interface Word {
                text?: string | undefined;
                font?: string | undefined;
                style?: string | undefined;
                weight?: string | number | undefined;
                rotate?: number | undefined;
                size?: number | undefined;
                padding?: number | undefined;
                x?: number | undefined;
                y?: number | undefined;
            }
            
            interface DeadZone {
                x1: number;
                y1: number;
                x2: number;
                y2: number;
            }
            
            interface Cloud<T extends cloud.Word> {
                start(incremental?: boolean): Cloud<T>;
                stop(): Cloud<T>;
                reset(): Cloud<T>;
                timeInterval(): number;
                timeInterval(interval: number): Cloud<T>;
                words(): T[];
                words(words: T[]): Cloud<T>;
                addWords(words: T[] | T): Cloud<T>;
                size(): [number, number];
                size(size: [number, number]): Cloud<T>;
                font(): (datum: T, index: number) => string;
                font(font: string | ((datum: T, index: number) => string)): Cloud<T>;
                fontStyle(): (datum: T, index: number) => string;
                fontStyle(style: string | ((datum: T, index: number) => string)): Cloud<T>;
                fontWeight(): (datum: T, index: number) => string | number;
                fontWeight(weight: string | number | ((datum: T, index: number) => string | number)): Cloud<T>;
                rotate(): (datum: T, index: number) => number;
                rotate(rotate: number | ((datum: T, index: number) => number)): Cloud<T>;
                text(): (datum: T, index: number) => string;
                text(text: string | ((datum: T, index: number) => string)): Cloud<T>;
                spiral(): (size: [number, number]) => (t: number) => [number, number];
                spiral(name: string | ((size: [number, number]) => (t: number) => [number, number])): Cloud<T>;
                fontSize(): (datum: T, index: number) => number;
                fontSize(size: number | ((datum: T, index: number) => number)): Cloud<T>;
                padding(): (datum: T, index: number) => number;
                padding(padding: number | ((datum: T, index: number) => number)): Cloud<T>;
                /**
                 * If specified, sets the internal random number generator,used for selecting the initial position of each word,
                 * and the clockwise/counterclockwise direction of the spiral for each word.
                 *
                 * @param randomFunction should return a number in the range [0, 1).The default is Math.random.
                 */
                random(): Cloud<T>;
                random(randomFunction: () => number): Cloud<T>;
                /**
                 * If specified, sets the canvas generator function, which is used internally to draw text.
                 * When using Node.js, you will almost definitely override the default, e.g. using the canvas module.
                 * @param canvasGenerator should return a HTMLCanvasElement.The default is:  ()=>{document.createElement("canvas");}
                 */
                canvas(): Cloud<T>;
                canvas(canvasGenerator: () => HTMLCanvasElement): Cloud<T>;
                on(type: "word", listener: (word: T) => void): Cloud<T>;
                on(type: "end", listener: (tags: T[], bounds: Array<{ x: number; y: number }>) => void): Cloud<T>;
                on(type: string, listener: (...args: any[]) => void): Cloud<T>;
                on(type: "word"): (word: T) => void;
                on(type: "end"): (tags: T[], bounds: Array<{ x: number; y: number }>) => void;
                on(type: string): (...args: any[]) => void;
                /**
                 * Returns the current array of tags for the word cloud.
                 */
                tags(): T[];
                /**
                 * Adds a rectangular area where words should not be placed.
                 * @param x The x-coordinate of the top-left corner of the dead zone.
                 * @param y The y-coordinate of the top-left corner of the dead zone.
                 * @param width The width of the dead zone.
                 * @param height The height of the dead zone.
                 */
                addDeadZone(x: number, y: number, width: number, height: number): Cloud<T>;
                /**
                 * Removes all dead zones from the word cloud.
                 */
                clearDeadZones(): Cloud<T>;
                /**
                 * Returns the current array of dead zones.
                 */
                getDeadZones(): DeadZone[];
            }
        }
    }
}
