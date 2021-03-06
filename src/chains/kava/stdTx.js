const Base64 = require('base64-node');
const Utils = require('../../util/utils');
const Codec = require('../../util/codec');
const Config = require('../../../config');
const Builder = require('../../builder');
const Amino = require('../base');
const TxSerializer = require('./tx/tx_serializer');
const Root = require('./tx/tx');

const { StdFee } = Root.kava;
const { Coin } = Root.kava;

StdFee.prototype.GetSignBytes = function () {
  if (Utils.isEmpty(this.amount)) {
    this.amount = [new Coin({ denom: '', amount: '0' })];
  }
  return {
    amount: this.amount,
    gas: this.gas,
  };
};

class StdSignMsg extends Builder.Msg {
  constructor(chainID, accnum, sequence, fee, msg, memo, msgType) {
    super(msgType);
    this.chain_id = chainID;
    this.account_number = accnum;
    this.sequence = sequence;
    this.fee = fee;
    this.msgs = [msg];
    this.memo = memo;
  }

  GetSignBytes() {
    const msgs = [];
    this.msgs.forEach((msg) => {
      msgs.push(msg.GetSignBytes());
    });

    const tx = {
      account_number: this.account_number,
      chain_id: this.chain_id,
      fee: this.fee.GetSignBytes(),
      memo: this.memo,
      msgs,
      sequence: this.sequence,
    };
    return Utils.sortObjectKeys(tx);
  }

  ValidateBasic() {
    if (Utils.isEmpty(this.chain_id)) {
      throw new Error('chain_id is  empty');
    }
    if (this.account_number < 0) {
      throw new Error('account_number is  empty');
    }
    if (this.sequence < 0) {
      throw new Error('sequence is  empty');
    }
    this.msgs.forEach((msg) => {
      msg.ValidateBasic();
    });
  }
}

class StdTx {
  constructor(properties) {
    this.msgs = properties.msgs;
    this.fee = properties.fee;
    this.signatures = null;
    this.memo = properties.memo;
    this.signMsg = properties;
  }

  SetSignature(sig) {
    if (typeof sig === 'string') {
      sig = JSON.parse(sig);
    }
    const signature = new Root.kava.StdSignature({
      pubKey: sig.pub_key,
      signature: sig.signature,
    });
    this.signatures = [signature];
  }

  SetPubKey(pubkey) {
    if (Codec.Bech32.isBech32(Config.kava.bech32.accPub, pubkey)) {
      pubkey = Codec.Bech32.fromBech32(pubkey);
    }
    pubkey = Codec.Hex.hexToBytes(pubkey);
    if (!this.signatures || this.signatures.length == 0) {
      const signature = {
        pub_key: pubkey,
      };
      this.SetSignature(signature);
      return;
    }
    this.signatures[0].pubKey = pubkey;
  }

  GetData() {
    const signatures = [];
    if (this.signatures) {
      this.signatures.forEach((sig) => {
        let publicKey = '';
        let signature = '';
        if (sig.pubKey.length > 33) {
          // 去掉amino编码前缀
          publicKey = sig.pubKey.slice(5, sig.pubKey.length);
        }
        publicKey = Base64.encode(publicKey);

        if (!Utils.isEmpty(sig.signature)) {
          signature = Base64.encode(sig.signature);
        }

        signatures.push({
          pub_key: Amino.MarshalJSON(Config.kava.amino.pubKey, publicKey),
          signature,
        });
      });
    }

    const msgs = [];
    this.msgs.forEach((msg) => {
      msgs.push(msg.GetSignBytes());
    });
    const fee = {
      amount: this.fee.amount,
      gas: Utils.toString(this.fee.gas),
    };
    return {
      tx: {
        msg: msgs,
        fee,
        signatures,
        memo: this.memo,
      },
      mode: 'sync',
    };
  }

  /**
     *  用于计算交易hash和签名后的交易内容(base64编码)
     *
     *  可以直接将data提交到irishub的/txs接口
     *
     * @returns {{data: *, hash: *}}
     * @constructor
     */
  Hash() {
    const result = TxSerializer.encode(this);
    return {
      data: this.GetData(),
      hash: result.hash,
    };
  }

  GetSignBytes() {
    return this.signMsg.GetSignBytes();
  }

  GetDisplayContent() {
    const msg = this.msgs[0];
    const content = msg.GetDisplayContent();
    content.i18n_fee = this.fee.amount;
    return content;
  }
}

module.exports = class Bank {
  static create(req, msg) {
    const fee = new StdFee({
      amount: req.fees,
      gas: req.gas,
    });
    const stdMsg = new StdSignMsg(req.chain_id, req.account_number, req.sequence, fee, msg, req.memo, req.type);
    stdMsg.ValidateBasic();
    return new StdTx(stdMsg);
  }
};
