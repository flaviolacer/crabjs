const rm = require("../../base/repository-manager");
const cjs = require("../../base/cjs");

/**
 * @Entity
 * @RepositoryName('__revoked_storage')
 */
function __revoked_storage() {
    /**
     * @field("_id")
     * @primaryKey
     **/
    let token;

    /** @field */
    let client_id;

    /** @field */
    let data;

    this.removeExpired = async function () {
        let entityName = "__revoked_storage";
        let md = rm.getConnection();
        let entity = cjs.entityManager.loadEntity(entityName);
        // specific to mongodb
        let options = {
            "entity": entityName,
            "pipeline": [
                {
                    $project:
                        {
                            _id: 1,
                            seconds: {
                                $dateDiff: {
                                    startDate: "$data.date",
                                    endDate: "$$NOW",
                                    unit: "second"
                                }
                            },
                            "expires": "$data.expires"
                        }
                },
                {
                    $match: {
                        $expr: {
                            $gte: ["$seconds", "$expires"]
                        }
                    }
                }
            ]
        };
        let expiredTokens = (await md.aggregate(options)).results;
        for (let i = 0,j = expiredTokens.length;i < j; i++) {
            let expiredToken = expiredTokens[i];
            await md.remove({_id: expiredToken._id, definitions: entity.__definitions });
        }
    }
}

module.exports = __revoked_storage;