import yaml
from methodtools import lru_cache

class ConfigItem:
  pass

class Config:
  def __init__(self):
    data = self._load_configs()

    def add_attrs(base, data_dict):
      for k in data_dict.keys():
        if type(data_dict[k]) is dict:
          setattr(base, k, ConfigItem())
          add_attrs(getattr(base, k), data_dict[k])
        else:
          setattr(base, k, data_dict[k])

    add_attrs(self, data)

  @lru_cache(maxsize=4)
  @classmethod
  def _load_configs(self):
    return {
      **yaml.safe_load(open("config.yaml"))
    }
