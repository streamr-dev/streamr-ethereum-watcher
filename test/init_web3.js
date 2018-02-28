const Web3 = require("web3")

module.exports = rpc => {

    // if URL is given just use that
    if (typeof rpc === "string") {
        return new Web3(rpc)
    }

    // otherwise run testrpc
    const testrpc = require("ethereumjs-testrpc")
    return new Web3(testrpc.provider({
        mnemonic: "we make your streams come true",
        total_accounts: 10,
        gasLimit: 5000000
    }))
}

/*
Available Accounts on testrpc
=============================
(0) 0x725bf47f71061034757b37cc7b9f73671c7b2973
(1) 0x66c595baf661c8dfcebc50dd431b727246d748d4
(2) 0xdb0ada416674557aa697cf33d261ce02d4016776
(3) 0x72cf0d1ac81571a6cf767fd649ec95f5e12da541
(4) 0x942e694ec12d009f45aead2563426adc182ff527
(5) 0x23cdc37931c4142ec6c326326d59db37a27fc354
(6) 0x996f0e99758d8fd32d196243fa178a95a6c71784
(7) 0x993b0c35a9474b5d99fa7302024932bc4ed54d3c
(8) 0x4e702165bc042e38b4e22653751e49d40ed9e732
(9) 0x247c7ffcc5f9d3c46eb4621c1bf68e11eb75ac01

Private Keys of above accounts
==============================
(0) 0961b1b8028fa43057caf48c64874a5a131c12b1dac79bd43f1be0bebbc40dda
(1) 936169f3b3bb0939ef01f9af6a3c7aa43f2685635535e832a9381d83743cec4e
(2) a5098d5b746c96d807ec8ce8f689eb200789a289cfbf841bd5c8752c97c468c0
(3) a89d697cb0e3e4b623459c226a034a426ed7d9ef592306856077d2cb13e9f263
(4) 4b521de73b0d1478dd8688e8739a19510be002769da235477a5f68afe140c87d
(5) f29b9f3ff34a04b25508f1df4ae2693a65d3348d21fd9e7fce583afd329afac0
(6) 52537c936fdf1546e84944f3ac34a4769ef66ae4f37ebdca519baed51370e75e
(7) fea6fed3e64c0ca2ea2848f37136fdd629cd399438eace16068548a09df1ae70
(8) af1f7be0f1a6aaaab6bb3ac896d0484c9de1cf622853e08439feef62ebf10ba1
(9) 1fc1c6719f3c1da565d67c0d5edbdda6dec40db50f7624cdf8cb3c5db7572fce
*/
