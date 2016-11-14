const _ = require('lodash');
const natural = require('natural');
const util = require('util');
const stripTags = require('underscore.string').stripTags;
let stopWords;

exports.extract = (text, options) => {
    let results = [];
    const keywords = {};
    let combined;
    const combinedResults = {};
    const unstemmed = {};

    const stem = word => {
        // only bother stemming if the word will be used
        if (!usePhrase(word, options)) return word;
        const stem = natural.PorterStemmer.stem(word);
        // Store the shortest word that matches this stem for later destemming
        if (!unstemmed.hasOwnProperty(stem) || word.length < unstemmed[stem].length) {
            unstemmed[stem] = word;
        }
        return stem;
    };

    const destem = stem => unstemmed[stem];

    if (!text) return [];
    if (typeof text !== 'string') text = text.toString();

    if (!options) options = {};
    if (!options.ngrams) {
        options.ngrams = [1, 2, 3];
    } else if (typeof options.ngrams === 'number') {
        options.ngrams = [options.ngrams];
    }
    if (!options.cutoff) options.cutoff = 0.5;
    if (!options.min) options.min = 2;
    if (!options.stopWords) options.stopWords = [];
    if (!options.startWords) options.startWords = [];
    if (options.html) {
        text = stripTags(text);
    }

    stopWords = options.stopWords;
    natural.NGrams.setTokenizer(new natural.AggressiveTokenizerFa());

    // For each ngram, extract the most frequent phrases (taking into account
    // stop and start words lists)
    _.each(options.ngrams, ngram => {
        let keywordsForNgram;
        const tf = new Tf();
        const tokenized = _.map(natural.NGrams.ngrams(text, ngram), ngram => {
            if (options.stem) {
                ngram = _.map(ngram, stem);
            }
            return ngram.join(' ').toLowerCase();
        });
        tf.addDocument(tokenized);
        keywordsForNgram = tf.listMostFrequestTerms(0);
        keywordsForNgram = _.filter(keywordsForNgram, item => usePhrase(item.term, options));
        results = results.concat(keywordsForNgram);
    });

    // Convert results to a hash
    _.each(results, result => {
        combinedResults[result.term] = result.tf;
    });

    // Combine results from each ngram to remove redundancy phrases
    combined = exports.combine(combinedResults, options.cutoff);

    // Convert to a list of objects sorted by tf (term frequency)
    combined = _.chain(combined)
        .toPairs()
        .sortBy(_.last)
        .reverse()
        .map(combination => ({
            term: combination[0],
            tf: combination[1]
        }))
        .value();

    // Only return results over a given frequency (default is 2 or more)
    if (options.min) {
        combined = _.filter(combined, result => result.tf >= options.min);
    }

    // If stemming was used, remap words back
    if (options.stem) {
        combined.forEach(result => {
            result.term = _.map(result.term.split(' '), destem).join(' ');
        });
    }

    if (options.flatten) {
        // Flatten the results so that there is a list item for every occurence of
        // the term
        combined = _.flatten(
            _.map(combined, result => {
                const flattened = [];
                for (let i = 0; i < result.tf; i++) {
                    flattened.push(result.term);
                }
                return flattened;
            })
        );
    } else {
        // Return results with scores or without depending on options
        combined = options.score ? combined : _.pluck(combined, 'term');
    }


    // Limit the results
    if (options.limit) {
        combined = combined.slice(0, options.limit);
    }

    return combined;
};

// Attempt to combine the results for different ngrams in order to work out
// whether we should use "national broadband network", rather than "national
// broadband" and "broadband network". In this example with a cutoff of .2,
// if the longer phrase (ngram of 3) was used 20 times, and "broadband network"
// was used 22 times (within the cutoff of 20 * 0.2), then it would be removed
// from the results. If "national broadband" was used more than the cutoff,
// e.g. 30 times, it would be left in the results.
exports.combine = (phrases, cutoff) => {
    const combined = _.clone(phrases);

    _.each(_.keys(phrases), phrase => {
        let ngramToTry;
        let subPhrases;
        ngramToTry = phrase.split(' ').length - 1;

        if (ngramToTry < 1) return;

        _.each(natural.NGrams.ngrams(phrase, ngramToTry), ngram => {
            const subPhrase = ngram.join(' ');
            if (phrases[subPhrase]) {
                if (!cutoff || (phrases[phrase] / phrases[subPhrase]) >= (1 - cutoff)) {
                    delete combined[subPhrase];
                }
            }
        });
    });

    return combined;
};

class Tf extends natural.TfIdf {
    constructor() {
        super();
    }

    listMostFrequestTerms(d) {
        const terms = [];
        for (const term in this.documents[d]) {
            terms.push({ term, tf: natural.TfIdf.tf(term, this.documents[d]) });
        }
        return terms.sort((x, y) => y.tf - x.tf);
    }
}

function whitelisted(term, startWords) {
    return startWords.includes(term);
}

function blacklisted(term, extraStopWords) {
    if (term.match(/^\d+$/) || term.match(/^_/)) {
        return true;
    }
    return _.indexOf(stopWords, term) !== -1 ||
        _.indexOf(extraStopWords, term) !== -1;
}

function usePhrase(phrase, options) {
    return whitelisted(phrase, options.startWords) ||
        !_.find(phrase.split(' '), term => blacklisted(term, options.stopWords));
}