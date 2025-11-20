import { Account } from "./lib/acount.js";

const acc = new Account('flpSe7f_zOb-tzFTaGZvgyi4a9X87amifMGBsU7DZLY')
//console.log(await acc.getUpdatedEmails({ deltaToken: 'H4sIAAAAAAAA_2NgZmBkAAOmMn-GFgjzrhoDS0ZJbg4AAWfA_x0AAAA' }))

await acc.syncEmails()
