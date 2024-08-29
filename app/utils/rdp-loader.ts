import * as fs from "fs";
import path from "path";
import { bytesToString } from "./helpers";

interface Config { dir: string; dbfilename: string };

export function loadRDB(config: Config) {
    if (config.dbfilename === '') {
        return {};
    }
    const filePath = path.join(config.dir, config.dbfilename);
    const rdb = new RDBParser(filePath);
    rdb.parse();
    return rdb.getEntries();
}

class RDBParser {
    path: string;
    data: Uint8Array;
    index: number = 0;
    entries: Record<string, DBItem> = {};

    constructor(path: string) {
        this.path = path;
        try {
            this.data = fs.readFileSync(this.path);

        } catch (error: any) {
            this.data = new Uint8Array();

            if (error.code === "ENOENT") {
                // create the file if it doesn't exist
                fs.writeFileSync(this.path, "");
            } else {
                console.error(error);
            }

            return;
        }
    }
    parse() {
        if (this.data?.length === 0) return;
        if (bytesToString(this.data.slice(0, 5)) !== "REDIS") {
            console.log(`Invalid RDB file: ${this.path}`);
            return;
        }
        console.log(`Version: ${bytesToString(this.data.slice(5, 9))}`);
        //skip header and version
        this.index = 9;
        let eof = false;
        while (!eof && this.index < this.data.length) {
            const op = this.data[this.index++];
            switch (op) {
                case 0xFA: {
                    const key = this.readEncodedString();
                    switch (key) {
                        case "redis-ver":
                            console.log(key, this.readEncodedString());
                            break
                        case "redis-bits":
                            console.log(key, this.readEncodedInt());
                            break;
                        case "ctime":
                            console.log(key, new Date(this.readEncodedInt() * 1000));
                            break;
                        case "used-mem":
                            console.log(key, this.readEncodedInt());
                            break;
                        case "aof-preamble":
                            console.log(key, this.readEncodedInt());
                            break;
                        default:
                            throw Error("unknown auxiliary field");
                    }
                    break;
                }
                case 0xFB:
                    console.log("keyspace", this.readEncodedInt());
                    console.log("expires", this.readEncodedInt());
                    this.readEntries();
                    break;
                case 0xFE:
                    console.log("db selector", this.readEncodedInt());
                    break;
                case 0xFF:
                    eof = true;
                    break;
                default:
                    throw Error("op not implemented: " + op);

            }
            if (eof) {
                break;
            }
        }
    }
    readEntries() {
        while (this.index < this.data.length) {
            let type = this.data[this.index++];
            let expiration: Date | undefined;
            if (type === 0xFF) {
                this.index--;
                break;
            } else if (type === 0xFC) { // Expire time in milliseconds
                expiration = new Date(this.readEncodedInt());
                type = this.data[this.index++];
            } else if (type === 0xFD) { // Expire time in seconds
                expiration = new Date(this.readEncodedInt() * 1000);
                type = this.data[this.index++];
            }
            const key = this.readEncodedString();
            switch (type) {
                case 0: // string encoding
                    this.entries[key] = { value: this.readEncodedString(), px: expiration, type: "string" };
                    break;
                default:
                    throw Error("type not implemented: " + type);
            }
        }
    }
    readEncodedInt(): number {
        let length = 0;
        const type = this.data[this.index] >> 6;
        switch (type) {
            case 0:
                length = this.data[this.index++];
                break;
            case 1:
                length =
                    (this.data[this.index++] & 0b00111111) |
                    (this.data[this.index++] << 6);
                break;
            case 2:
                this.index++;
                length =
                    (this.data[this.index++] << 24) |
                    (this.data[this.index++] << 16) |
                    (this.data[this.index++] << 8) |
                    this.data[this.index++];
                break;
            case 3: {
                const bitType = this.data[this.index++] & 0b00111111;
                length = this.data[this.index++];
                if (bitType > 1) {
                    length |= this.data[this.index++] << 8;
                }
                if (bitType == 2) {
                    length |=
                        (this.data[this.index++] << 16) | (this.data[this.index++] << 24);
                }
                if (bitType > 2) {
                    throw Error("length not implemented");
                }
                break;
            }
        }
        return length;
    }
    readEncodedString(): string {
        const length = this.readEncodedInt();
        const str = bytesToString(this.data.slice(this.index, this.index + length));
        this.index += length;
        return str;
    }
    getEntries(): Record<string, DBItem> {
        return this.entries;
    }

}