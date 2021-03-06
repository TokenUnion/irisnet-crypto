const BECH32 = require('bech32');
const Config = require('../../../config');
const Root = require('./tx/tx');
const Utils = require('../../util/utils');
const Amino = require('../base');

const voteOptionMapping = {
  0x00: 'Empty',
  0x01: 'Yes',
  0x02: 'Abstain',
  0x03: 'No',
  0x04: 'NoWithVeto',
};

const { MsgDeposit } = Root.kava;
MsgDeposit.prototype.type = Config.kava.tx.deposit.prefix;
MsgDeposit.prototype.GetSignBytes = function () {
  const depositor = BECH32.encode(Config.kava.bech32.accAddr, this.depositor);
  const signMsg = {
    proposal_id: `${this.proposalID}`,
    depositor,
    amount: this.amount,
  };
  const sortMsg = Utils.sortObjectKeys(signMsg);
  return Amino.MarshalJSON(this.type, sortMsg);
};

MsgDeposit.prototype.ValidateBasic = function () {
  if (Utils.isEmpty(this.amount)) {
    throw new Error('amount is  empty');
  }
  if (Utils.isEmpty(this.proposalID)) {
    throw new Error('proposal_id is  empty');
  }
  if (Utils.isEmpty(this.depositor)) {
    throw new Error('depositor is  empty');
  }
};

MsgDeposit.prototype.GetMsg = function () {
  const depositor = BECH32.fromWords(this.depositor);
  return {
    proposalID: this.proposalID,
    depositor,
    amount: this.amount,
  };
};

MsgDeposit.prototype.GetDisplayContent = function () {
  const depositor = BECH32.encode(Config.kava.bech32.accAddr, this.depositor);
  return {
    i18n_tx_type: 'i18n_deposit',
    i18n_proposal_id: this.proposalID,
    i18n_depositor: depositor,
    i18n_amount: this.amount,
  };
};
MsgDeposit.prototype.toJSON = function () {
  const depositor = BECH32.encode(Config.kava.bech32.accAddr, this.depositor);
  return {
    proposal_id: this.proposalID,
    depositor,
    amount: this.amount,
  };
};

const { MsgVote } = Root.kava;
MsgVote.prototype.type = Config.kava.tx.vote.prefix;
MsgVote.prototype.GetSignBytes = function () {
  const voter = BECH32.encode(Config.kava.bech32.accAddr, this.voter);
  const signMsg = {
    proposal_id: `${this.proposalID}`,
    voter,
    option: voteOptionMapping[this.option],
  };
  const sortMsg = Utils.sortObjectKeys(signMsg);
  return Amino.MarshalJSON(this.type, sortMsg);
};
MsgVote.prototype.ValidateBasic = function () {
  if (Utils.isEmpty(this.option)) {
    throw new Error('option is  empty');
  }
  if (Utils.isEmpty(this.proposalID)) {
    throw new Error('proposal_id is  empty');
  }
  if (Utils.isEmpty(this.voter)) {
    throw new Error('voter is  empty');
  }
};
MsgVote.prototype.GetMsg = function () {
  const voter = BECH32.fromWords(this.voter);
  return {
    proposalID: this.proposalID,
    voter,
    option: this.option,
  };
};
MsgVote.prototype.GetDisplayContent = function () {
  const voter = BECH32.encode(Config.kava.bech32.accAddr, this.voter);
  return {
    i18n_tx_type: 'i18n_vote',
    i18n_proposal_id: this.proposalID,
    i18n_voter: voter,
    option: voteOptionMapping[this.option],
  };
};
MsgVote.prototype.toJSON = function () {
  const voter = BECH32.encode(Config.kava.bech32.accAddr, this.voter);
  return {
    proposal_id: this.proposalID,
    voter,
    option: voteOptionMapping[this.option],
  };
};

module.exports = class Gov {
  static createMsgDeposit(req) {
    const coins = [];
    if (!Utils.isEmpty(req.msg.amount)) {
      req.msg.amount.forEach((item) => {
        coins.push({
          denom: item.denom,
          amount: Utils.toString(item.amount),
        });
      });
    }
    return new MsgDeposit({
      proposalID: `${req.msg.proposal_id}`,
      depositor: BECH32.decode(req.from).words,
      amount: coins,
    });
  }

  static createMsgVote(req) {
    return new MsgVote({
      proposalID: `${req.msg.proposal_id}`,
      voter: BECH32.decode(req.from).words,
      option: req.msg.option,
    });
  }
};
