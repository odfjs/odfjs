import test from 'ava';
import { sheetRawContentToObjects } from "../exports.js"

test("Empty header value should be kept", t => {
    const rawContent = [
        [
            {
                type: "string",
                value: "",
            },
            {
                type: "string",
                value: "Pitchou",
            },
        ],
        [
            {
                type: "string",
                value: "1",
            },
            {
                type: "string",
                value: "2",
            },
        ]
    ]

    const object = sheetRawContentToObjects(rawContent)

    t.deepEqual(
        object, 
        [
            {
                "Column 1": "1",
                "Pitchou": "2",
            }
        ]
    )
}) 