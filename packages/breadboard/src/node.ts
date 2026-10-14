export interface WireOptions {
  required?: boolean;
}

export class Wire {
  source: Node;
  target: Node;
  required: boolean;

  constructor(source: Node, target: Node, required: boolean = false) {
    this.source = source;
    this.target = target;
    this.required = required;
  }
}

export class Node {
  id: string;
  outgoing: Wire[] = [];

  constructor(id: string) {
    this.id = id;
    this.outgoing = [];
  }

  to(target: Node, options?: WireOptions): Wire {
    const wire = new Wire(this, target, options?.required);
    this.outgoing.push(wire);
    return wire;
  }

  requiredTo(target: Node): Wire {
    return this.to(target, { required: true });
  }
}